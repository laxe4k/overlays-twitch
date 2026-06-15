<script setup lang="ts">
import DotField from '@/components/DotField.vue'
import OverlayContent from '@/components/OverlayContent.vue'
</script>

<template>
  <DotField color="#14d8fe" />
  <div class="error-wrap">
    <OverlayContent line1="ON A UN PROBLÈME" line2="TECHNIQUE" subtitle="ON REVIENT VITE" />
  </div>
</template>

<style scoped>
.error-wrap :deep(.content) {
  color: #fecf03;
}
.error-wrap :deep(.content .outline) {
  -webkit-text-stroke: 2px #fecf03;
  -webkit-text-stroke-color: #fecf03;
}
.error-wrap :deep(.overlay-sub) {
  color: #fecf03;
}
</style>
