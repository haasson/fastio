import type { TagIconPreset } from '@fastio/shared'
import {
  // Еда и напитки
  Flame, CookingPot, Soup, Pizza, Sandwich, Beef, Egg, Salad, IceCream,
  Fish, Shrimp, Drumstick, Ham, Hamburger, Bone,
  Croissant, Donut, Cookie, Cake, CakeSlice, Popcorn, Candy, Lollipop,
  Coffee, Wine, Beer, GlassWater, CupSoda, Milk, BottleWine, IceCreamBowl,
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
  // Каталог товаров
  Package, Box, ShoppingBag, Shirt, Gem, Watch, Glasses, Layers,
  Palette, Recycle, Globe, Umbrella, Thermometer,
  // Услуги
  Laptop, Home, MapPin, Car, Plane,
  Scissors, Wrench, Brush, Camera, Stethoscope, GraduationCap, Code, PenTool, Mic, Music,
  User, Users, UserCheck,
  type LucideIcon,
} from 'lucide-vue-next'

// Тип Record<TagIconPreset, ...> гарантирует что при добавлении новой иконки в
// packages/shared/src/utils/tagPresets.ts TypeScript сразу покажет ошибку здесь.
const TAG_ICON_MAP: Record<TagIconPreset, LucideIcon> = {
  Flame, CookingPot, Soup, Pizza, Sandwich, Beef, Egg, Salad, IceCream,
  Fish, Shrimp, Drumstick, Ham, Hamburger, Bone,
  Croissant, Donut, Cookie, Cake, CakeSlice, Popcorn, Candy, Lollipop,
  Coffee, Wine, Beer, GlassWater, CupSoda, Milk, BottleWine, IceCreamBowl,
  Leaf, Vegan, Apple, Carrot, Cherry, Grape, Citrus, Banana, Bean,
  Wheat, WheatOff, Nut, NutOff, Sprout, HeartPulse, Baby, ShieldCheck,
  Sparkles, Star, Zap, Crown, Award, ThumbsUp, TrendingUp, Percent, Gift,
  Clock, Timer, CalendarDays, Hourglass, Sunrise, Moon,
  Gauge, Dumbbell, Scale, Ruler, Droplets, Snowflake, Sun, AlertTriangle,
  Tag, Bookmark, Heart, CircleCheck, Info, Ban,
  Package, Box, ShoppingBag, Shirt, Gem, Watch, Glasses, Layers,
  Palette, Recycle, Globe, Umbrella, Thermometer,
  Laptop, Home, MapPin, Car, Plane,
  Scissors, Wrench, Brush, Camera, Stethoscope, GraduationCap, Code, PenTool, Mic, Music,
  User, Users, UserCheck,
}

export function resolveTagIcon(name: string): LucideIcon {
  return TAG_ICON_MAP[name as TagIconPreset] ?? Tag
}
