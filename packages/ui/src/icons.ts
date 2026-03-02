import {
  X,
  XCircle,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  PlusCircle,
  MinusCircle,
  Calendar,
  LogOut,
  Menu,
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  Gift,
  Settings,
} from 'lucide-vue-next'

export const iconRegistry = {
  // internal lib icons
  crossRound: XCircle,
  eye: Eye,
  eyeClose: EyeOff,
  warningRound: AlertCircle,
  checkRound: CheckCircle,
  chevronRound: ChevronDown,
  plusRound: PlusCircle,
  minusRound: MinusCircle,
  calendar: Calendar,
  close: X,
  // app icons
  logOut: LogOut,
  menu: Menu,
  dashboard: LayoutDashboard,
  dishes: UtensilsCrossed,
  orders: ClipboardList,
  promotions: Gift,
  settings: Settings,
} as const

export type IconName = keyof typeof iconRegistry
