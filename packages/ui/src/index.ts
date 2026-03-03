// Components
export { default as UiIcon } from './components/UiIcon.vue'
export { default as UiButton } from './components/UiButton.vue'
export { default as UiText } from './components/UiText.vue'
export { default as UiTitle } from './components/UiTitle.vue'
export { default as UiBadge } from './components/UiBadge.vue'
export { default as UiTag } from './components/UiTag.vue'
export { default as UiDivider } from './components/UiDivider.vue'

// Form components
export { default as UiForm } from './components/UiForm.vue'
export { default as UiInput } from './components/UiInput.vue'
export { default as UiInputNumber } from './components/UiInputNumber.vue'
export type { IconName } from './icons'
export { default as UiSelect } from './components/UiSelect.vue'
export { default as UiCheckbox } from './components/UiCheckbox.vue'
export { default as UiRadioGroup } from './components/UiRadioGroup.vue'
export { default as UiSwitch } from './components/UiSwitch.vue'
export { default as UiSegmentedControl } from './components/UiSegmentedControl.vue'
export { default as UiDatepicker } from './components/UiDatepicker.vue'
export type { SegmentedControlItem } from './components/UiSegmentedControl.vue'
export type { UiSelectProps } from './components/UiSelect.vue'

// Container / overlay components
export { default as UiCard } from './components/UiCard.vue'
export { default as UiModal } from './components/UiModal.vue'
export { default as UiConfirmModal } from './components/UiConfirmModal.vue'
export { default as UiBottomSheet } from './components/UiBottomSheet.vue'
export { default as UiPopover } from './components/UiPopover.vue'
export { default as UiCollapse } from './components/UiCollapse.vue'
export { default as UiCollapseItem } from './components/UiCollapseItem.vue'
export { default as UiTabs } from './components/UiTabs.vue'
export type { UiCardProps } from './components/UiCard.vue'
export type { UiModalProps, ModalAction } from './components/UiModal.vue'
export type { UiBottomSheetProps } from './components/UiBottomSheet.vue'

// Navigation components
export { default as UiLink } from './components/UiLink.vue'
export { default as UiBreadcrumbs } from './components/UiBreadcrumbs.vue'
export { default as UiMenu } from './components/UiMenu.vue'
export { default as UiMenuDropdown } from './components/UiMenuDropdown.vue'
export type { BreadcrumbItem } from './components/UiBreadcrumbs.vue'
export type { UiMenuOption, UiMenuKey } from './components/UiMenu.vue'
export type { UiMenuDropdownItem } from './components/UiMenuDropdown.vue'

// Provider
export { default as UiConfigProvider } from './components/UiConfigProvider.vue'

// Utility components
export { default as UiAlert } from './components/UiAlert.vue'
export { default as UiSpace } from './components/UiSpace.vue'
export { default as UiPagination } from './components/UiPagination.vue'
export { default as UiSkeleton } from './components/UiSkeleton.vue'
export { default as UiGrid } from './components/UiGrid.vue'
export { default as UiPicture } from './components/UiPicture.vue'
export type { UiSpaceProps } from './components/UiSpace.vue'
export type { UiPictureProps } from './components/UiPicture.vue'

// Composables
export { default as useBreakpoints } from './composables/useBreakpoints'
export { default as useModals, useModalConfig, modalManager } from './composables/useModals'
export { default as useConfirm, confirmState } from './composables/useConfirm'
export { default as useResponsiveSize } from './composables/useResponsiveSize'
export { useApi, useGlobalApiError, ApiError } from './composables/useApi'
export type { UseApiOptions, UseApiReturn, UseApiUrl } from './composables/useApi'
// Types
export type { Size, Breakpoint, ResponsiveSizeMap } from './types/responsive'
export { BREAKPOINTS_ORDER } from './types/responsive'
export type { ModalController, ModalConfig, UseModalsReturn } from './types/modals'
export type { ConfirmOptions } from './composables/useConfirm'

// Form types
export type { ValidationRule, ValidationRuleType, FormValues, FormContext } from './types/form'

// Constants
export { FORM_SIZE_KEY } from './constants/form-size'
