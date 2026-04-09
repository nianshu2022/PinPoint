<script lang="ts" setup>
import type { AttributionControlOptions, StyleSpecification } from 'maplibre-gl'
import { twMerge } from 'tailwind-merge'
import type { MapboxMap, MapInstance, MaplibreMap } from '~~/shared/types/map'

import ChronoFrameLightStyle from '~/assets/mapStyles/chronoframe_light.json'
import ChronoFrameDarkStyle from '~/assets/mapStyles/chronoframe_dark.json'

withDefaults(
  defineProps<{
    class?: string
    mapId?: string
    center?: [number, number]
    zoom?: number
    interactive?: boolean
    attributionControl?: false | AttributionControlOptions
    language?: string
  }>(),
  {
    class: undefined,
    mapId: undefined,
    center: undefined,
    zoom: 2,
    interactive: true,
    attributionControl: false,
    language: undefined,
  },
)

const emit = defineEmits<{
  load: [map: MapInstance]
  zoom: []
}>()

const colorMode = useColorMode()

const mapConfig = computed(() => {
  const config = getSetting('map')
  return typeof config === 'object' && config ? config : {}
})

const provider = computed(() => mapConfig.value.provider || 'maplibre')
const mapStyle = computed(() => {
  if (provider.value === 'mapbox') {
    return (
      mapConfig.value['mapbox.style'] || `mapbox://styles/mapbox/standard`
    )
  } else {
    const token = mapConfig.value['maplibre.token']
    if (false) { // Always use AMap logic below
      // Fallback to OSM raster tiles if no token and no custom style provided
      return {
        version: 8,
        sources: {
          'osm-raster': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors',
          },
        },
        layers: [
          {
            id: 'osm-raster-layer',
            type: 'raster',
            source: 'osm-raster',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      } as StyleSpecification
    }

    const styleConfig =
      colorMode.value === 'dark' ? ChronoFrameDarkStyle : ChronoFrameLightStyle

    // Default style (style=8) - Simplified map
    // style=7 - Standard vector map (more details)
    // style=6 - Satellite map
    const mapStyleType: number = 8

    const tileDomain = mapStyleType === 6 ? 'webst' : 'webrd'

    return (
      mapConfig.value['maplibre.style'] ||
      ({
        ...styleConfig,
        sources: {
          openmaptiles: {
            type: 'raster',
            tiles: [
              `https://${tileDomain}01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=${mapStyleType}&x={x}&y={y}&z={z}`,
              `https://${tileDomain}02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=${mapStyleType}&x={x}&y={y}&z={z}`,
              `https://${tileDomain}03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=${mapStyleType}&x={x}&y={y}&z={z}`,
              `https://${tileDomain}04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=${mapStyleType}&x={x}&y={y}&z={z}`,
            ],
            tileSize: 256,
            attribution: '&copy; AutoNavi',
            maxzoom: 18, // Specify maxzoom for the source to enable overzooming
          },
        },
        layers: [
          {
            id: 'amap-layer',
            type: 'raster',
            source: 'openmaptiles',
            minzoom: 0,
            maxzoom: 24, // Allow layer to be visible at higher zoom levels (overzoom)
            paint: {
              // Adjust raster brightness for dark mode to reduce glare
              'raster-brightness-max': colorMode.value === 'dark' ? 0.7 : 1,
              'raster-saturation': colorMode.value === 'dark' ? -0.4 : 0,
              'raster-contrast': colorMode.value === 'dark' ? 0.3 : 0,
            },
          },
        ],
        // Must provide a valid glyphs URL even if not used, or remove the property completely from the object if the type allows
        // MapLibre validates this property strictly
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf', 
      } as StyleSpecification)
    )
  }
})
</script>

<template>
  <div :class="twMerge('w-full h-full', $props.class)">
    <ClientOnly>
      <MglMap
        v-if="provider === 'maplibre'"
        :map-key="mapId"
        :map-style="mapStyle as StyleSpecification"
        :center
        :zoom
        :interactive
        :attribution-control
        @map:load="emit('load', $event.map as MaplibreMap)"
        @map:zoom="emit('zoom')"
      >
        <slot />
      </MglMap>
      <MapboxMap
        v-else
        :map-id="mapId || 'cframe-mapbox-map'"
        :options="{
          accessToken: mapConfig['mapbox.token'],
          style: mapStyle,
          center: center,
          zoom: zoom,
          interactive: interactive,
          attributionControl: attributionControl,
          language: language,
          config: {
            basemap: {
              lightPreset: $colorMode.value === 'dark' ? 'night' : 'day',
              colorThemes: 'faded',
            },
          },
        }"
        @load="emit('load', $event as MapboxMap)"
        @zoom="emit('zoom')"
      >
        <slot />
      </MapboxMap>
    </ClientOnly>
  </div>
</template>

<style scoped></style>

