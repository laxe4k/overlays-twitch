<script setup lang="ts">
import DotField from '@/components/DotField.vue'
import OverlayContent from '@/components/OverlayContent.vue'
</script>

<template>
  <DotField color="#3147d8" />
  <div class="error-wrap">
    <OverlayContent line1="ON A UN PROBLÈME" line2="TECHNIQUE" subtitle="ON REVIENT VITE" />
  </div>
</template>

<style scoped>
.error-wrap :deep(.content) {
  color: #14d8fe;
}
.error-wrap :deep(.content .outline) {
  -webkit-text-stroke: 2px #14d8fe;
  -webkit-text-stroke-color: #fecf03;
}
</style>
