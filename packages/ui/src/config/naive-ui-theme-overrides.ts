import type { GlobalThemeOverrides } from 'naive-ui'
import { COLORS } from '../constants/colors'

function deepMerge(target: GlobalThemeOverrides, source: GlobalThemeOverrides): GlobalThemeOverrides {
  const result = { ...target } as Record<string, unknown>

  for (const key of Object.keys(source)) {
    const targetVal = result[key]
    const sourceVal = (source as Record<string, unknown>)[key]

    if (
      targetVal && sourceVal
      && typeof targetVal === 'object' && typeof sourceVal === 'object'
      && !Array.isArray(targetVal) && !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as GlobalThemeOverrides,
        sourceVal as GlobalThemeOverrides,
      )
    } else {
      result[key] = sourceVal
    }
  }

  return result as GlobalThemeOverrides
}

// Theme-independent overrides: sizes, fonts, paddings, border-radius, durations
const baseOverrides = {
  common: {
    fontFamily: 'Inter, sans-serif',
    fontWeightStrong: '700',
    borderRadius: '12px',
    fontSizeTiny: '14px',
    fontSizeSmall: '14px',
    fontSizeMedium: '14px',
    fontSizeLarge: '14px',
    heightTiny: '24px',
    heightSmall: '32px',
    heightMedium: '40px',
    heightLarge: '48px',
    primaryColor: COLORS.PRIMARY,
    primaryColorHover: COLORS.BLUE_400,
    primaryColorPressed: COLORS.PRIMARY,
    successColor: COLORS.SUCCESS,
    errorColor: COLORS.RED_500,
    errorColorHover: COLORS.RED_600,
    errorColorPressed: COLORS.RED_700,
    fontWeight: '700',
  },
  Button: {
    rippleDuration: '0',
    borderRadiusTiny: '6px',
    borderRadiusSmall: '8px',
    borderRadiusMedium: '8px',
    borderRadiusLarge: '12px',
    paddingTiny: '0 20px',
    paddingSmall: '0 20px',
    paddingMedium: '0 20px',
    paddingLarge: '0 20px',
    iconMarginTiny: '8px',
    iconMarginSmall: '8px',
    iconMarginMedium: '8px',
    iconMarginLarge: '8px',
    iconSizeTiny: '16px',
    iconSizeSmall: '16px',
    iconSizeMedium: '24px',
    iconSizeLarge: '24px',
  },
  Input: {
    fontWeight: '400',
    // Минимум 16px чтобы iOS Safari не зумил страницу при фокусе
    fontSizeTiny: '16px',
    fontSizeSmall: '16px',
    fontSizeMedium: '16px',
    fontSizeLarge: '16px',
    boxShadowFocus: 'none',
    boxShadowFocusWarning: 'none',
    boxShadowFocusError: 'none',
    paddingTiny: '0 8px',
    paddingSmall: '0 12px',
    paddingMedium: '0 16px',
    paddingLarge: '0 16px 0 24px',
  },
  Checkbox: {
    sizeSmall: '16px',
    sizeMedium: '20px',
    sizeLarge: '24px',
    fontSizeSmall: '12px',
    fontSizeMedium: '14px',
    fontSizeLarge: '16px',
    borderRadius: '5px',
    border: `2px solid ${COLORS.PRIMARY}`,
    borderChecked: `2px solid ${COLORS.PRIMARY}`,
    borderFocus: `2px solid ${COLORS.PRIMARY}`,
    boxShadowFocus: 'none',
  },
  Radio: {
    radioSizeSmall: '16px',
    radioSizeMedium: '20px',
    radioSizeLarge: '24px',
    fontSizeSmall: '12px',
    fontSizeMedium: '14px',
    fontSizeLarge: '16px',
    boxShadow: `inset 0 0 0 2px ${COLORS.PRIMARY}`,
    boxShadowActive: `inset 0 0 0 2px ${COLORS.PRIMARY}`,
    boxShadowFocus: `inset 0 0 0 2px ${COLORS.PRIMARY}`,
    boxShadowHover: `inset 0 0 0 2px ${COLORS.BLUE_400}`,
  },
  Select: {
    menuBoxShadow: 'none',
    borderHover: `2px solid ${COLORS.BLUE_400}`,
    borderActive: `2px solid ${COLORS.BLUE_400}`,
    borderFocus: `2px solid ${COLORS.BLUE_400}`,
    peers: {
      InternalSelectMenu: {
        optionHeightTiny: '24px',
        optionHeightSmall: '32px',
        optionHeightMedium: '40px',
        optionHeightLarge: '48px',
      },
    },
  },
  DatePicker: {
    itemColorActive: COLORS.PRIMARY,
    itemColorActiveHover: COLORS.BLUE_400,
    itemBorderRadius: '50px',
    arrowSize: '24px',
  },
  Pagination: {
    buttonColor: 'transparent',
    itemColor: 'transparent',
    buttonBorder: 'none',
    itemBorderActive: 'none',
    pageSlot: 7,
    itemBorderRadius: '8px',
    itemFontSizeTiny: '12px',
    itemFontSizeSmall: '14px',
    itemFontSizeMedium: '16px',
    itemFontSizeLarge: '16px',
  },
  Menu: {
    itemHeight: '38px',
    itemColorHover: 'transparent',
    itemColorActive: 'transparent',
    itemColorActiveHover: 'transparent',
  },
  DataTable: {
    thPaddingSmall: '2px 4px',
    tdPaddingSmall: '2px 4px',
    thPaddingMedium: '6px 10px',
    tdPaddingMedium: '6px 10px',
    thPaddingLarge: '10px 16px',
    tdPaddingLarge: '10px 16px',
  },
  Message: {
    borderRadius: '10px',
  },
} satisfies GlobalThemeOverrides

// Light theme color overrides
const lightColors = {
  common: {
    baseColor: COLORS.WHITE,
    borderColor: COLORS.GREY_200,
    textColorBase: COLORS.TITLE,
    closeIconColor: COLORS.GREY_100,
  },
  Input: {
    placeholderColor: COLORS.GREY_300,
    textColorDisabled: COLORS.GREY_300,
    groupLabelBorder: `2px solid ${COLORS.GREY_200}`,
    border: `2px solid ${COLORS.GREY_200}`,
    borderHover: `2px solid ${COLORS.BLUE_400}`,
    borderDisabled: `2px solid ${COLORS.GREY_200}`,
    borderFocus: `2px solid ${COLORS.BLUE_400}`,
    borderWarning: `2px solid ${COLORS.WARNING}`,
    borderHoverWarning: `2px solid ${COLORS.YELLOW_400}`,
    borderFocusWarning: `2px solid ${COLORS.YELLOW_400}`,
    borderError: `2px solid ${COLORS.ERROR}`,
    borderHoverError: `2px solid ${COLORS.RED_500}`,
    borderFocusError: `2px solid ${COLORS.RED_500}`,
  },
  Collapse: {
    dividerColor: COLORS.GREY_200,
  },
  Checkbox: {
    checkMarkColorDisabled: COLORS.GREY_200,
    checkMarkColorDisabledChecked: COLORS.WHITE,
    colorDisabledChecked: COLORS.GREY_200,
    borderDisabled: `2px solid ${COLORS.GREY_200}`,
    borderDisabledChecked: `2px solid ${COLORS.GREY_200}`,
    textColor: COLORS.TITLE,
    textColorDisabled: COLORS.GREY_300,
  },
  Radio: {
    boxShadowDisabled: `inset 0 0 0 2px ${COLORS.GREY_200}`,
    textColorDisabled: COLORS.GREY_300,
    textColor: COLORS.TITLE,
  },
  Select: {
    border: `2px solid ${COLORS.GREY_200}`,
    peers: {
      InternalSelectMenu: {
        optionColorPending: COLORS.BLUE_50,
        optionColorActive: COLORS.BLUE_50,
        optionColorActivePending: COLORS.BLUE_50,
      },
    },
  },
  DatePicker: {
    calendarDividerColor: COLORS.GREY_200,
    calendarTitleColorHover: COLORS.BLUE_50,
    itemColorHover: COLORS.BLUE_50,
  },
  Pagination: {
    itemColorActive: COLORS.BLUE_50,
    itemColorHover: COLORS.BLUE_50,
    itemColorPressed: COLORS.BLUE_50,
    itemColorActiveHover: COLORS.BLUE_50,
  },
  Menu: {
    itemTextColor: COLORS.GREY_900,
    itemTextColorHover: COLORS.GREY_900,
    itemTextColorActive: COLORS.TITLE,
    itemTextColorActiveHover: COLORS.TITLE,
    itemTextColorChildActive: COLORS.TITLE,
    itemTextColorChildActiveHover: COLORS.TITLE,
    itemIconColorActive: COLORS.TITLE,
    itemIconColorActiveHover: COLORS.TITLE,
    itemIconColorChildActive: COLORS.TITLE,
    itemIconColorChildActiveHover: COLORS.TITLE,
    arrowColorActive: COLORS.TITLE,
    arrowColorActiveHover: COLORS.TITLE,
    arrowColorChildActive: COLORS.TITLE,
    arrowColorChildActiveHover: COLORS.TITLE,
  },
  Alert: {
    colorInfo: COLORS.BLUE_50,
    colorSuccess: COLORS.GREEN_100,
    colorWarning: COLORS.YELLOW_100,
    colorError: COLORS.RED_100,
  },
  Message: {
    color: COLORS.GREY_900,
    colorInfo: COLORS.GREY_900,
    colorSuccess: COLORS.GREY_900,
    colorWarning: COLORS.GREY_900,
    colorError: COLORS.GREY_900,
    colorLoading: COLORS.GREY_900,
    textColorInfo: COLORS.WHITE,
    textColorSuccess: COLORS.WHITE,
    textColorWarning: COLORS.WHITE,
    textColorError: COLORS.WHITE,
    iconColorInfo: COLORS.BLUE_400,
    iconColorSuccess: COLORS.GREEN_500,
    iconColorWarning: COLORS.YELLOW_400,
    iconColorError: COLORS.RED_500,
    closeIconColor: COLORS.GREY_400,
    closeIconColorHover: COLORS.WHITE,
    closeIconColorPressed: COLORS.WHITE,
  },
} satisfies GlobalThemeOverrides

// Dark theme color overrides
const darkColors: GlobalThemeOverrides = {
  common: {
    baseColor: COLORS.GREY_900,
    borderColor: COLORS.GREY_700,
    textColorBase: COLORS.GREY_50,
    closeIconColor: COLORS.GREY_600,
  },
  Input: {
    placeholderColor: COLORS.GREY_500,
    textColorDisabled: COLORS.GREY_600,
    groupLabelBorder: `2px solid ${COLORS.GREY_700}`,
    border: `2px solid ${COLORS.GREY_700}`,
    borderHover: `2px solid ${COLORS.BLUE_400}`,
    borderDisabled: `2px solid ${COLORS.GREY_700}`,
    borderFocus: `2px solid ${COLORS.BLUE_400}`,
    borderWarning: `2px solid ${COLORS.WARNING}`,
    borderHoverWarning: `2px solid ${COLORS.YELLOW_400}`,
    borderFocusWarning: `2px solid ${COLORS.YELLOW_400}`,
    borderError: `2px solid ${COLORS.ERROR}`,
    borderHoverError: `2px solid ${COLORS.RED_500}`,
    borderFocusError: `2px solid ${COLORS.RED_500}`,
  },
  Collapse: {
    dividerColor: COLORS.GREY_700,
  },
  Checkbox: {
    checkMarkColorDisabled: COLORS.GREY_700,
    checkMarkColorDisabledChecked: COLORS.GREY_900,
    colorDisabledChecked: COLORS.GREY_600,
    borderDisabled: `2px solid ${COLORS.GREY_700}`,
    borderDisabledChecked: `2px solid ${COLORS.GREY_700}`,
    textColor: COLORS.GREY_50,
    textColorDisabled: COLORS.GREY_600,
  },
  Radio: {
    boxShadowDisabled: `inset 0 0 0 2px ${COLORS.GREY_700}`,
    textColorDisabled: COLORS.GREY_600,
    textColor: COLORS.GREY_50,
  },
  Select: {
    border: `2px solid ${COLORS.GREY_700}`,
    peers: {
      InternalSelectMenu: {
        optionColorPending: 'rgba(59, 130, 246, 0.15)',
        optionColorActive: 'rgba(59, 130, 246, 0.15)',
        optionColorActivePending: 'rgba(59, 130, 246, 0.15)',
      },
    },
  },
  DatePicker: {
    calendarDividerColor: COLORS.GREY_700,
    calendarTitleColorHover: 'rgba(59, 130, 246, 0.15)',
    itemColorHover: 'rgba(59, 130, 246, 0.15)',
  },
  Pagination: {
    itemColorActive: 'rgba(59, 130, 246, 0.15)',
    itemColorHover: 'rgba(59, 130, 246, 0.15)',
    itemColorPressed: 'rgba(59, 130, 246, 0.15)',
    itemColorActiveHover: 'rgba(59, 130, 246, 0.15)',
  },
  Menu: {
    itemTextColor: COLORS.GREY_300,
    itemTextColorHover: COLORS.GREY_300,
    itemTextColorActive: COLORS.GREY_50,
    itemTextColorActiveHover: COLORS.GREY_50,
    itemTextColorChildActive: COLORS.GREY_50,
    itemTextColorChildActiveHover: COLORS.GREY_50,
    itemIconColorActive: COLORS.GREY_50,
    itemIconColorActiveHover: COLORS.GREY_50,
    itemIconColorChildActive: COLORS.GREY_50,
    itemIconColorChildActiveHover: COLORS.GREY_50,
    arrowColorActive: COLORS.GREY_50,
    arrowColorActiveHover: COLORS.GREY_50,
    arrowColorChildActive: COLORS.GREY_50,
    arrowColorChildActiveHover: COLORS.GREY_50,
  },
  Alert: {
    colorInfo: 'rgba(59, 130, 246, 0.15)',
    colorSuccess: 'rgba(16, 185, 129, 0.15)',
    colorWarning: 'rgba(234, 179, 8, 0.15)',
    colorError: 'rgba(239, 68, 68, 0.15)',
  },
  Message: {
    color: COLORS.GREY_100,
    colorInfo: COLORS.GREY_100,
    colorSuccess: COLORS.GREY_100,
    colorWarning: COLORS.GREY_100,
    colorError: COLORS.GREY_100,
    colorLoading: COLORS.GREY_100,
    textColorInfo: COLORS.GREY_900,
    textColorSuccess: COLORS.GREY_900,
    textColorWarning: COLORS.GREY_900,
    textColorError: COLORS.GREY_900,
    iconColorInfo: COLORS.BLUE_400,
    iconColorSuccess: COLORS.GREEN_500,
    iconColorWarning: COLORS.YELLOW_400,
    iconColorError: COLORS.RED_500,
    closeIconColor: COLORS.GREY_500,
    closeIconColorHover: COLORS.GREY_900,
    closeIconColorPressed: COLORS.GREY_900,
  },
}

export const lightThemeOverrides: GlobalThemeOverrides = deepMerge(baseOverrides, lightColors)
export const darkThemeOverrides: GlobalThemeOverrides = deepMerge(baseOverrides, darkColors)

export default lightThemeOverrides
