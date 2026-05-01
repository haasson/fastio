import { ref, computed } from 'vue'
import type { EditorState, EditorSnapshot } from '~/components/appointments/types'
import { buildServicesKey } from './utils'

/**
 * Вычисляет dirty/snapshot для редактора. Snapshot — это мгновенный слепок
 * полей формы, который сравнивается с текущим state для определения «есть ли
 * несохранённые изменения». В create-mode snapshot всегда пуст и dirty=true,
 * как только юзер ввёл хоть что-то.
 */
export function useEditorSnapshot(state: EditorState, mode: 'create' | 'edit') {
  const snapshot = ref<EditorSnapshot | null>(null)

  const takeSnapshot = (): void => {
    snapshot.value = {
      customerName: state.customerName,
      customerPhone: state.customerPhone,
      customerEmail: state.customerEmail,
      notes: state.notes,
      branchId: state.branchId,
      date: state.date,
      servicesKey: buildServicesKey(state.services),
    }
  }

  // Частичный снапшот только для меты клиента/филиала. Используется в
  // saveConvertRequest когда updateMeta уже прошла, а convertRequest ещё нет —
  // мета в БД зафиксирована, services — нет, поэтому date/servicesKey не трогаем.
  const takeMetaSnapshot = (): void => {
    if (!snapshot.value) {
      takeSnapshot()

      return
    }
    snapshot.value = {
      ...snapshot.value,
      customerName: state.customerName,
      customerPhone: state.customerPhone,
      customerEmail: state.customerEmail,
      notes: state.notes,
      branchId: state.branchId,
    }
  }

  const dateDirty = computed(() => state.date !== snapshot.value?.date)

  const servicesDirty = computed(() => {
    const hasPendingCancels = state.services.some((s) => s.pendingRemove && s.appointmentId)

    return buildServicesKey(state.services) !== snapshot.value?.servicesKey || hasPendingCancels
  })

  const dirty = computed((): boolean => {
    if (mode === 'create') {
      return state.customerName !== ''
        || state.customerPhone !== ''
        || state.customerEmail !== ''
        || state.notes !== ''
        || state.date !== null
        || state.services.length > 0
    }

    return state.customerName !== snapshot.value?.customerName
      || state.customerPhone !== snapshot.value?.customerPhone
      || state.customerEmail !== snapshot.value?.customerEmail
      || state.notes !== snapshot.value?.notes
      || dateDirty.value
      || servicesDirty.value
  })

  return { snapshot, takeSnapshot, takeMetaSnapshot, dirty }
}
