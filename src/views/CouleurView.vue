<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { lerpColor, useSmtcArtworkColor } from '@/composables/useDotField'

const color = useSmtcArtworkColor()
const backgroundColor = computed(
  () =>
    `rgb(${Math.round(color.r * 255)} ${Math.round(color.g * 255)} ${Math.round(color.b * 255)})`,
)

let animationFrame = 0
let lastColorFrame = 0

function animateColor(timestamp: number) {
  animationFrame = requestAnimationFrame(animateColor)
  if (timestamp - lastColorFrame < 1000 / 30) return

  lastColorFrame = timestamp
  lerpColor()
}

onMounted(() => {
  animationFrame = requestAnimationFrame(animateColor)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
})
</script>

<template>
  <main class="fullscreen-color" :style="{ backgroundColor }" aria-label="Couleur de l’album" />
</template>

<style scoped>
.fullscreen-color {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
}
</style>
