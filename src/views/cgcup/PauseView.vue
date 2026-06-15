<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import DotField from '@/components/DotField.vue'

const total = ref('Chargement…')
let pollTimer: ReturnType<typeof setInterval>

async function fetchTotal() {
  try {
    const res = await fetch('https://streamlabscharity.com/api/v1/teams/@cgcup-2026/cgcup-2026')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    total.value = `${(data.amount_raised / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}€ récoltés`
  } catch (e) {
    console.error('CGCup fetch failed', e)
    total.value = `cgcup.fr`
  }
}

onMounted(() => {
  fetchTotal()
  pollTimer = setInterval(fetchTotal, 4000)
})

onBeforeUnmount(() => {
  clearInterval(pollTimer)
})

const yeah = new Date().getFullYear();
</script>

<template>
  <DotField color="#14d8fe" />
  <div class="cg-top">
    <p class="cg-title">CgCup {{ yeah }}</p>
    <p class="cg-title cg-outline">LE LIVE EST EN PAUSE</p>
  </div>
  <div class="cg-milieu"><!-- libre pour tes trucs perso --></div>
  <div class="cg-bottom">{{ total }}</div>
</template>

<style scoped>
.cg-top {
  position: absolute;
  z-index: 1;
  top: 2rem;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  padding: 2rem 4rem;
  white-space: nowrap;
}
.cg-title {
  font-weight: 900;
  font-size: 4rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  line-height: 1.15;
  margin: 0;
  color: #fecf03;
  text-shadow: 0 0 8px #000, 0 0 20px #000, 0 0 40px rgba(0,0,0,0.95), 0 0 80px rgba(0,0,0,0.8);
}
.cg-title.cg-outline {
  color: transparent;
  font-size: 4.5rem;
  -webkit-text-stroke: 2px #fecf03;
  text-shadow: none;
  filter: drop-shadow(0 0 8px #000) drop-shadow(0 0 30px rgba(0,0,0,0.8));
}
.cg-milieu {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.cg-bottom {
  position: absolute;
  z-index: 1;
  left: 50%;
  bottom: 2rem;
  transform: translateX(-50%);
  font-family: 'Poppins', sans-serif;
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: #fecf03;
  text-shadow: 0 0 10px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.7);
}
</style>
