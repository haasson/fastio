import {
  // Еда и напитки
  Flame, CookingPot, Soup, Pizza, Sandwich, Beef, Egg, Salad, IceCream,
  Fish, Shrimp, Drumstick, Ham, Hamburger, Bone,
  Croissant, Donut, Cookie, Cake, CakeSlice, Popcorn, Candy, Lollipop,
  Coffee, Wine, Beer, GlassWater, CupSoda, Milk,
  // Диета и здоровье
  Leaf, Vegan, Apple, Carrot, Cherry, Grape, Citrus, Banana, Bean,
  Wheat, WheatOff, Nut, NutOff, Sprout, HeartPulse, Baby, ShieldCheck,
  // Маркетинг
  Sparkles, Star, Zap, Crown, Award, ThumbsUp, TrendingUp, Percent, Gift,
  // Время и статус
  Clock, Timer, CalendarDays, Hourglass, Sunrise, Moon,
  // Характеристики
  Gauge, Dumbbell, Scale, Ruler, Droplets, Snowflake, Sun, AlertTriangle,
  // Общие
  Tag, Bookmark, Heart, CircleCheck, Info, Ban,
  type LucideIcon,
} from 'lucide-vue-next'

const TAG_ICON_MAP: Record<string, LucideIcon> = {
  Flame, CookingPot, Soup, Pizza, Sandwich, Beef, Egg, Salad, IceCream,
  Fish, Shrimp, Drumstick, Ham, Hamburger, Bone,
  Croissant, Donut, Cookie, Cake, CakeSlice, Popcorn, Candy, Lollipop,
  Coffee, Wine, Beer, GlassWater, CupSoda, Milk,
  Leaf, Vegan, Apple, Carrot, Cherry, Grape, Citrus, Banana, Bean,
  Wheat, WheatOff, Nut, NutOff, Sprout, HeartPulse, Baby, ShieldCheck,
  Sparkles, Star, Zap, Crown, Award, ThumbsUp, TrendingUp, Percent, Gift,
  Clock, Timer, CalendarDays, Hourglass, Sunrise, Moon,
  Gauge, Dumbbell, Scale, Ruler, Droplets, Snowflake, Sun, AlertTriangle,
  Tag, Bookmark, Heart, CircleCheck, Info, Ban,
}

export function resolveTagIcon(name: string): LucideIcon {
  return TAG_ICON_MAP[name] ?? Tag
}
