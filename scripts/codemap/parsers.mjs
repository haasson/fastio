import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Project, Node, SyntaxKind, ts } from 'ts-morph';
import { parse as parseSFC } from '@vue/compiler-sfc';

// Изолированный проект ts-morph — без резолва импортов и lib-файлов.
// Это критично для скорости: иначе getType()/резолв тянут всю экосистему.
const project = new Project({
  useInMemoryFileSystem: true,
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
  skipLoadingLibFiles: true,
  compilerOptions: {
    allowJs: false,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noResolve: true,
    isolatedModules: true,
    skipLibCheck: true,
  },
});

let counter = 0;
function virtualPath(ext = 'ts') {
  return `__scan_${counter++}.${ext}`;
}

export function fileHash(content) {
  return crypto.createHash('sha1').update(content).digest('hex').slice(0, 12);
}

export function symbolHash(signature) {
  return crypto.createHash('sha1').update(signature).digest('hex').slice(0, 8);
}

function cleanType(t) {
  if (!t) return 'unknown';
  return String(t)
    .replace(/import\([^)]+\)\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

// Только текст из аннотации, без вызова getType() (медленный, тянет резолв).
function typeNodeText(typed) {
  return typed?.getTypeNode?.()?.getText() ?? null;
}

function paramText(p) {
  const name = p.getName();
  const optional = p.isOptional() ? '?' : '';
  const rest = p.isRestParameter() ? '...' : '';
  const t = typeNodeText(p) ?? 'unknown';
  return `${rest}${name}${optional}: ${cleanType(t)}`;
}

function returnTypeText(decl) {
  const node = decl.getReturnTypeNode?.();
  if (node) return cleanType(node.getText());
  return 'unknown';
}

function getFunctionSignature(decl) {
  const name = decl.getName?.() ?? '<anonymous>';
  const params = (decl.getParameters?.() ?? []).map(paramText).join(', ');
  return `${name}(${params}): ${returnTypeText(decl)}`;
}

function getVariableSignature(decl) {
  const name = decl.getName();
  const init = decl.getInitializer?.();
  const tn = typeNodeText(decl);
  if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
    const params = init.getParameters().map(paramText).join(', ');
    const ret = returnTypeText(init);
    return { kind: 'function', signature: `${name}(${params}): ${ret}` };
  }
  if (tn) {
    return { kind: 'const', signature: `${name}: ${cleanType(tn)}` };
  }
  // если инициализатор простой — покажем его
  if (init) {
    const text = init.getText();
    if (text.length < 100) return { kind: 'const', signature: `${name} = ${cleanType(text)}` };
  }
  return { kind: 'const', signature: `${name}` };
}

function getInterfaceSignature(decl) {
  const name = decl.getName();
  const props = decl.getProperties().map((p) => {
    const tn = typeNodeText(p) ?? 'unknown';
    const optional = p.hasQuestionToken() ? '?' : '';
    return `${p.getName()}${optional}: ${cleanType(tn)}`;
  });
  const methods = decl.getMethods().map((m) => {
    const params = m.getParameters().map(paramText).join(', ');
    const ret = returnTypeText(m);
    return `${m.getName()}(${params}): ${ret}`;
  });
  return `${name} { ${[...props, ...methods].join('; ')} }`;
}

function getTypeAliasSignature(decl) {
  const name = decl.getName();
  const t = decl.getTypeNode()?.getText() ?? 'unknown';
  return `${name} = ${cleanType(t)}`;
}

function getClassSignature(decl) {
  const name = decl.getName();
  const ctor = decl.getConstructors()[0];
  const ctorSig = ctor
    ? `constructor(${ctor.getParameters().map(paramText).join(', ')})`
    : '';
  const methods = decl.getInstanceMethods()
    .filter((m) => !m.hasModifier(SyntaxKind.PrivateKeyword))
    .map((m) => {
      const params = m.getParameters().map(paramText).join(', ');
      const ret = returnTypeText(m);
      return `${m.getName()}(${params}): ${ret}`;
    });
  const body = [ctorSig, ...methods].filter(Boolean).join('; ');
  return `${name} { ${body} }`;
}

function getEnumSignature(decl) {
  const name = decl.getName();
  const members = decl.getMembers().map((m) => m.getName()).join(', ');
  return `${name} { ${members} }`;
}

function describeDecl(name, decl) {
  try {
    if (Node.isFunctionDeclaration(decl)) {
      return { name, kind: 'function', signature: getFunctionSignature(decl) };
    }
    if (Node.isVariableDeclaration(decl)) {
      const v = getVariableSignature(decl);
      return { name, kind: v.kind, signature: v.signature };
    }
    if (Node.isInterfaceDeclaration(decl)) {
      return { name, kind: 'interface', signature: getInterfaceSignature(decl) };
    }
    if (Node.isTypeAliasDeclaration(decl)) {
      return { name, kind: 'type', signature: getTypeAliasSignature(decl) };
    }
    if (Node.isClassDeclaration(decl)) {
      return { name, kind: 'class', signature: getClassSignature(decl) };
    }
    if (Node.isEnumDeclaration(decl)) {
      return { name, kind: 'enum', signature: getEnumSignature(decl) };
    }
    return { name, kind: 'other', signature: cleanType(decl.getText().split('\n')[0]) };
  } catch (err) {
    return { name, kind: 'error', signature: `<parse error: ${err.message}>` };
  }
}

function collectExportedSymbolsFromSourceFile(sf) {
  const symbols = [];
  const seen = new Set();

  for (const [exportName, decls] of sf.getExportedDeclarations()) {
    if (decls.length === 0) continue; // пустой = ts-morph не зарезолвил — обработаем через re-export ниже
    for (const decl of decls) {
      symbols.push(describeDecl(exportName, decl));
    }
    seen.add(exportName);
  }

  // Re-exports добираем отдельно — при `noResolve: true` ts-morph не может
  // следовать по `export { x } from '...'`, и они не попадают в getExportedDeclarations.
  for (const exp of sf.getExportDeclarations()) {
    const moduleSpec = exp.getModuleSpecifierValue();
    if (!moduleSpec) continue; // local re-export уже учли выше

    const named = exp.getNamedExports();
    if (named.length > 0) {
      for (const ne of named) {
        const name = ne.getAliasNode()?.getText() ?? ne.getName();
        if (seen.has(name)) continue;
        symbols.push({
          name,
          kind: 're-export',
          signature: `(re-export from '${moduleSpec}')`,
        });
        seen.add(name);
      }
    } else if (exp.getNamespaceExport?.()) {
      const ns = exp.getNamespaceExport().getName();
      symbols.push({
        name: ns,
        kind: 're-export',
        signature: `(* as ${ns} from '${moduleSpec}')`,
      });
    } else {
      symbols.push({
        name: '*',
        kind: 're-export',
        signature: `(* from '${moduleSpec}')`,
      });
    }
  }

  return symbols;
}

export function parseTSContent(content, ext = 'ts') {
  const sf = project.createSourceFile(virtualPath(ext), content, { overwrite: true });
  let symbols;
  try {
    symbols = collectExportedSymbolsFromSourceFile(sf);
  } finally {
    project.removeSourceFile(sf);
  }
  for (const s of symbols) s.hash = symbolHash(s.signature);
  return symbols;
}

// ------------------------- Vue parser -------------------------

function findDefineCall(sf, callName) {
  const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
  for (const call of calls) {
    if (call.getExpression().getText() === callName) return call;
  }
  return null;
}

function resolveLocalTypeShape(sf, typeText) {
  const trimmed = typeText.trim();
  if (trimmed.startsWith('{') || trimmed.includes('|') || trimmed.includes('&')) return trimmed;
  const iface = sf.getInterface(trimmed);
  if (iface) {
    const props = iface.getProperties().map((p) => {
      const optional = p.hasQuestionToken() ? '?' : '';
      const tn = typeNodeText(p) ?? 'unknown';
      return `${p.getName()}${optional}: ${cleanType(tn)}`;
    });
    return `{ ${props.join('; ')} }`;
  }
  const ta = sf.getTypeAlias(trimmed);
  if (ta) {
    const node = ta.getTypeNode();
    if (node) return cleanType(node.getText());
  }
  return trimmed;
}

function extractFromCall(sf, call, callName) {
  if (!call) return null;
  const typeArgs = call.getTypeArguments();
  const args = call.getArguments();
  if (typeArgs.length > 0) {
    const shape = resolveLocalTypeShape(sf, typeArgs[0].getText());
    return `${callName}<${cleanType(shape)}>()`;
  }
  if (args.length > 0) {
    return `${callName}(${cleanType(args[0].getText())})`;
  }
  return `${callName}()`;
}

export function parseVueContent(content, virtualName) {
  const { descriptor, errors } = parseSFC(content, { filename: virtualName });
  if (errors.length > 0) {
    return [{ name: '<sfc-parse-error>', kind: 'error', signature: errors[0].message, hash: 'err' }];
  }

  const symbols = [];
  const setup = descriptor.scriptSetup;
  const script = descriptor.script;

  if (setup) {
    const ext = setup.lang === 'js' ? 'js' : 'ts';
    const setupSF = project.createSourceFile(virtualPath(ext), setup.content, { overwrite: true });
    try {
      const propsCall = findDefineCall(setupSF, 'defineProps');
      const propsSig = extractFromCall(setupSF, propsCall, 'defineProps');
      if (propsSig) symbols.push({ name: 'props', kind: 'component-props', signature: propsSig });

      const emitsCall = findDefineCall(setupSF, 'defineEmits');
      const emitsSig = extractFromCall(setupSF, emitsCall, 'defineEmits');
      if (emitsSig) symbols.push({ name: 'emits', kind: 'component-emits', signature: emitsSig });

      const exposeCall = findDefineCall(setupSF, 'defineExpose');
      const exposeSig = extractFromCall(setupSF, exposeCall, 'defineExpose');
      if (exposeSig) symbols.push({ name: 'expose', kind: 'component-expose', signature: exposeSig });

      // дополнительные экспорты из script setup
      const extras = collectExportedSymbolsFromSourceFile(setupSF)
        .filter((s) => !['props', 'emits', 'expose'].includes(s.name));
      symbols.push(...extras);
    } finally {
      project.removeSourceFile(setupSF);
    }
  }

  if (script) {
    const ext = script.lang === 'js' ? 'js' : 'ts';
    try {
      const extras = parseTSContent(script.content, ext);
      symbols.push(...extras);
    } catch {/* ignore */}
  }

  if (symbols.length === 0) {
    symbols.push({ name: 'component', kind: 'component', signature: '<no props/emits>' });
  }

  for (const s of symbols) if (!s.hash) s.hash = symbolHash(s.signature);
  return symbols;
}

// ------------------------- file dispatch -------------------------

export function parseFile(absPath) {
  const content = fs.readFileSync(absPath, 'utf8');
  const ext = path.extname(absPath);
  const hash = fileHash(content);
  if (ext === '.vue') {
    return { hash, kind: 'vue', symbols: parseVueContent(content, absPath) };
  }
  if (ext === '.ts' || ext === '.tsx') {
    return { hash, kind: 'ts', symbols: parseTSContent(content, ext.slice(1)) };
  }
  if (ext === '.js' || ext === '.mjs') {
    return { hash, kind: 'ts', symbols: parseTSContent(content, 'js') };
  }
  return { hash, kind: 'unknown', symbols: [] };
}

// ------------------------- Nuxt pages URL -------------------------

export function pageRelToUrl(relFromPagesDir) {
  let p = relFromPagesDir.replace(/\.(vue|ts|tsx)$/, '');
  p = p.replace(/\/index$/, '');
  p = p.replace(/^index$/, '');
  p = p
    .split('/')
    .map((seg) => {
      const catchAll = seg.match(/^\[\.\.\.([^\]]+)\]$/);
      if (catchAll) return '*';
      const dynamic = seg.match(/^\[([^\]]+)\]$/);
      if (dynamic) return ':' + dynamic[1];
      return seg;
    })
    .join('/');
  return '/' + p;
}
