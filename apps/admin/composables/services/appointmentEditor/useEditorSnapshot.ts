import { ref, computed } from 'vue'
import type { EditorState, EditorSnapshot } from '~/components/appointments/types'
import { buildServicesKey } from './utils'

/**
 * Вычисляет dirty/snapshot для редактора. Snapshot — это мгновенный слепок
 * полей формы, который сравнивается с текущим state для определения «есть ли
 * несохранённые изменения». На старте snapshot=null, и пустые поля state
 * (customerName='', services=[]) сравниваются с дефолтами через `?? ''`.
 */
export function useEditorSnapshot(state: EditorState) {
  const snapshot = ref<EditorSnapshot | null>(null)

  const takeSnapshot = (): void => {
    snapshot.value = {
      customerName: state.customerName,
      customerPhone: state.customerPhone,
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
    // Сравниваем с snapshot одинаково для create/edit — это позволяет в create-mode
    // ПОСЛЕ saveCreate() обновить snapshot до уровня текущего state и тем самым
    // сбросить dirty=false (иначе useUnsavedGuard блокирует router.push с модалкой).
    const snap = snapshot.value

    return state.customerName !== (snap?.customerName ?? '')
      || state.customerPhone !== (snap?.customerPhone ?? '')
      || state.notes !== (snap?.notes ?? '')
      || dateDirty.value
      || servicesDirty.value
  })

  return { snapshot, takeSnapshot, takeMetaSnapshot, dirty }
}
