<template>
  <FsDialog v-model="open" :title="editing ? 'Редактировать адрес' : 'Новый адрес'" size="md" drawer-size="lg">
    <FsForm class="form-root" @submit="onSubmit">
      <FsField v-slot="{ hasError }" label="Название" required name="label" :model-value="form.label" :rules="[{ type: 'required', message: 'Введите название' }]">
        <FsInput v-model="form.label" placeholder="Дом, Работа..." :error="hasError" />
      </FsField>

      <FsField v-slot="{ hasError }" label="Адрес" required name="address" :model-value="form.address" :rules="[validationRules.address.required, { type: 'custom', validator: () => !addressTouched || addressVerified, message: 'Выберите адрес из списка' }]">
        <div class="address-wrap">
          <FsInput
            v-model="form.address"
            placeholder="Начните вводить адрес..."
            :error="hasError"
            @update:model-value="onAddressInput"
            @focus="showSuggestions = true"
            @blur="hideSuggestionsDelayed"
          />
          <FsDropdownList
            v-if="showSuggestions && suggestionItems.length"
            :items="suggestionItems"
            @select="onSuggestionSelect"
          />
        </div>
      </FsField>

      <div class="row">
        <FsField label="Подъезд">
          <FsInput v-model="form.entrance" />
        </FsField>
        <FsField label="Этаж">
          <FsInput v-model="form.floor" />
        </FsField>
      </div>

      <div class="row">
        <FsField label="Квартира">
          <FsInput v-model="form.apartment" />
        </FsField>
        <FsField label="Домофон">
          <FsInput v-model="form.intercom" />
        </FsField>
      </div>

      <FsField label="Комментарий">
        <FsTextarea v-model="form.comment" placeholder="Как найти и т.д." :rows="2" />
      </FsField>

      <FsAlert v-if="zoneCheckFailed" type="warning">
        Не удалось проверить зону доставки. Уточните у оператора.
      </FsAlert>
      <FsAlert v-else-if="outsideZoneWarning" type="warning">
        Похоже, мы не доставляем по этому адресу. Сохранить всё равно?
      </FsAlert>

      <FsButton type="submit" :disabled="loading" block>
        {{ loading ? 'Сохранение...' : outsideZoneWarning ? 'Всё равно сохранить' : 'Сохранить' }}
      </FsButton>
    </FsForm>
  </FsDialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import type { CustomerAddress } from '@fastio/shared'
import { FsDialog, FsField, FsForm, FsInput, FsTextarea, FsButton, FsDropdownList, FsAlert } from '@fastio/public-ui'
import { validationRules } from '@fastio/kit'
import type { DadataSuggestion } from '~/shared/composables/useDadataSuggestions'
import { useDadataSuggestions } from '~/shared/composables/useDadataSuggestions'
import { reportError } from '~/shared/utils/reportError'

const props = defineProps<{
  address?: CustomerAddress | null
}>()

const open = defineModel<boolean>({ required: true })

const emit = defineEmits<{
  save: [data: Record<string, unknown>]
}>()

const editing = ref(false)
const loading = ref(false)
const addressVerified = ref(false)
const addressTouched = ref(false)
const addressCoords = ref<{ lat: number; lng: number } | null>(null)
const outsideZone = ref(false)
const outsideZoneWarning = ref(false)
const zoneCheckFailed = ref(false)

const { suggestions, search, showSuggestions, hideSuggestionsDelayed, clear: clearSuggestions } = useDadataSuggestions()

const suggestionItems = computed(() =>
  suggestions.value.map((s) => ({ value: s.value, label: s.value, _raw: s })),
)

const form = reactive({
  label: '',
  address: '',
  entrance: '',
  floor: '',
  apartment: '',
  intercom: '',
  comment: '',
})

watch(open, (val) => {
  if (!val) {
    outsideZoneWarning.value = false
    zoneCheckFailed.value = false
  }
})

watch(() => props.address, (addr) => {
  if (addr) {
    editing.value = true
    addressVerified.value = true
    addressCoords.value = addr.coordinates ?? null
    form.label = addr.label
    form.address = addr.address
    form.entrance = addr.entrance ?? ''
    form.floor = addr.floor ?? ''
    form.apartment = addr.apartment ?? ''
    form.intercom = addr.intercom ?? ''
    form.comment = addr.comment ?? ''
  } else {
    editing.value = false
    addressVerified.value = false
    addressTouched.value = false
    addressCoords.value = null
    Object.assign(form, { label: '', address: '', entrance: '', floor: '', apartment: '', intercom: '', comment: '' })
  }
}, { immediate: true })

function onAddressInput(value: string | number) {
  form.address = String(value)
  addressVerified.value = false
  addressCoords.value = null
  outsideZone.value = false
  outsideZoneWarning.value = false
  search(form.address)
  showSuggestions.value = true
}

async function onSuggestionSelect(item: { value: string; [key: string]: unknown }) {
  const suggestion = (item as unknown as { _raw: DadataSuggestion })._raw
  form.address = suggestion.value
  addressVerified.value = true
  addressTouched.value = true
  showSuggestions.value = false
  clearSuggestions()

  const lat = parseFloat(suggestion.data.geo_lat ?? '')
  const lng = parseFloat(suggestion.data.geo_lon ?? '')
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    addressCoords.value = { lat, lng }
    zoneCheckFailed.value = false
    try {
      const result = await $fetch<{ zone: unknown | null; outsideZones?: boolean }>('/api/check-address', {
        method: 'POST',
        body: { lat, lon: lng, subtotal: 0 },
      })
      outsideZone.value = result?.outsideZones === true
    } catch (e) {
      reportError(e, { context: 'AddressFormModal:checkZone', lat, lng })
      zoneCheckFailed.value = true
      outsideZone.value = false
    }
  } else {
    addressCoords.value = null
    outsideZone.value = false
  }
}

async function onSubmit() {
  addressTouched.value = true
  if (outsideZone.value && !outsideZoneWarning.value) {
    outsideZoneWarning.value = true
    return
  }
  emit('save', { ...form, coordinates: addressCoords.value })
}
</script>

<style scoped lang="scss">
.address-wrap {
  position: relative;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
</style>
