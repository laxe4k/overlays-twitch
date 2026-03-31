<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { createDotFieldEngine } from '@/composables/useDotField'

const props = defineProps<{
  freeze?: boolean
}>()

const canvasRef = ref<HTMLCanvasElement>()
let engine: ReturnType<typeof createDotFieldEngine>

onMounted(() => {
  if (!canvasRef.value) return
  engine = createDotFieldEngine(canvasRef.value)
  engine.start()
  if (props.freeze) {
    engine.freezeAfter(3000)
  }
})

onBeforeUnmount(() => {
  engine?.destroy()
})
</script>

<template>
  <canvas ref="canvasRef" class="dot-field" />
</template>

<style scoped>
.dot-field {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>
