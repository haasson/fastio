const BASE_Z_INDEX = 2000
const STEP = 10

let stackDepth = 0

const push = (): number => {
  stackDepth++

  return BASE_Z_INDEX + stackDepth * STEP
}

const pop = (): void => {
  if (stackDepth > 0) {
    stackDepth--
  }
}

const getCurrentZIndex = (): number => BASE_Z_INDEX + stackDepth * STEP

export const layerManager = {
  push,
  pop,
  getCurrentZIndex,
}
