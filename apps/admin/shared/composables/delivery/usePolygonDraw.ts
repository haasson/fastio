import { ref, computed, watch, type Ref, type ShallowRef } from 'vue'

const SNAP_PX = 20
const DRAW_COLOR = '#FF5500'
const DRAW_COLOR_ALPHA = '#FF5500AA'

export const usePolygonDraw = (
  drawing: Ref<boolean>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mapInstance: ShallowRef<any>,
) => {
  const drawPoints = ref<[number, number][]>([])
  const cursorCoords = ref<[number, number] | null>(null)

  const getSnapThreshold = (): number => {
    const zoom = mapInstance.value?.zoom ?? 12
    const metersPerPx = 156543 / (1 << zoom)

    return (SNAP_PX * metersPerPx) / 111320
  }

  const isNearFirstPoint = (coords: [number, number]): boolean => {
    if (drawPoints.value.length < 3) return false
    const first = drawPoints.value[0]
    const threshold = getSnapThreshold()
    const dLng = coords[0] - first[0]
    const dLat = coords[1] - first[1]

    return (dLng * dLng + dLat * dLat) < threshold * threshold
  }

  const nearFirstPoint = computed(() => {
    if (!cursorCoords.value || !drawing.value) return false

    return isNearFirstPoint(cursorCoords.value)
  })

  // --- Feature settings ---

  const makeLineFeature = (id: string, coordinates: [number, number][]) => ({
    id,
    geometry: { type: 'LineString' as const, coordinates },
    style: { stroke: [{ color: DRAW_COLOR_ALPHA, width: 1.5, dash: [4, 4] }] },
  })

  const getDrawLinesSettings = () => ({
    id: 'drawing-lines',
    geometry: { type: 'LineString' as const, coordinates: drawPoints.value },
    style: { stroke: [{ color: DRAW_COLOR, width: 2, dash: [6, 4] }] },
  })

  const getDrawFillSettings = () => ({
    id: 'drawing-fill',
    geometry: { type: 'Polygon' as const, coordinates: [drawPoints.value] },
    style: { fill: '#FF550022', stroke: [{ color: 'transparent', width: 0 }] },
  })

  const getRubberBandSettings = () => makeLineFeature('drawing-rubber', [drawPoints.value[drawPoints.value.length - 1], cursorCoords.value!])

  const getClosingRubberBandSettings = () => makeLineFeature('drawing-closing-rubber', [cursorCoords.value!, drawPoints.value[0]])

  // --- Actions ---

  const addPoint = (coords: [number, number]) => {
    drawPoints.value = [...drawPoints.value, coords]
  }

  const finishDraw = (): [number, number][] | null => {
    if (drawPoints.value.length < 3) return null
    const result = [...drawPoints.value]

    drawPoints.value = []

    return result
  }

  const cancelDraw = () => {
    drawPoints.value = []
  }

  // Reset when drawing mode is turned off
  watch(drawing, (val) => {
    if (!val) {
      drawPoints.value = []
      cursorCoords.value = null
    }
  })

  return {
    drawPoints,
    cursorCoords,
    nearFirstPoint,
    isNearFirstPoint,
    addPoint,
    finishDraw,
    cancelDraw,
    getDrawLinesSettings,
    getDrawFillSettings,
    getRubberBandSettings,
    getClosingRubberBandSettings,
  }
}
