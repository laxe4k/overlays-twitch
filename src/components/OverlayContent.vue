<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'

const props = defineProps<{
  line1: string
  line2: string
  subtitle?: string
  countdown?: number
}>()

const line1Ref = ref<HTMLElement>()
const line2Ref = ref<HTMLElement>()
const subtitleRef = ref<HTMLElement>()
const countdownRef = ref<HTMLElement>()
const remaining = ref(props.countdown ?? 0)
let timer: ReturnType<typeof setInterval>

onMounted(() => {
  // GSAP entrance animations
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

  tl.from(line1Ref.value!, {
    y: 40,
    opacity: 0,
    duration: 0.8,
  })
  tl.from(
    line2Ref.value!,
    {
      y: 40,
      opacity: 0,
      duration: 0.8,
    },
    '-=0.5',
  )

  if (subtitleRef.value) {
    tl.from(
      subtitleRef.value,
      {
        y: 20,
        opacity: 0,
        duration: 0.6,
      },
      '-=0.3',
    )
  }

  if (countdownRef.value) {
    tl.from(
      countdownRef.value,
      {
        y: 20,
        opacity: 0,
        duration: 0.6,
      },
      '-=0.3',
    )
  }

  // Countdown timer
  if (props.countdown && props.countdown > 0) {
    remaining.value = props.countdown
    timer = setInterval(() => {
      if (remaining.value > 0) {
        remaining.value--
      } else {
        clearInterval(timer)
      }
    }, 1000)
  }
})

onBeforeUnmount(() => {
  clearInterval(timer)
})

function formatTime(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}
</script>

<template>
  <div class="content">
    <p ref="line1Ref">{{ line1 }}</p>
    <p ref="line2Ref" class="outline">{{ line2 }}</p>
  </div>
  <div v-if="subtitle" ref="subtitleRef" class="overlay-sub">{{ subtitle }}</div>
  <div v-if="countdown" ref="countdownRef" class="overlay-sub">
    {{ formatTime(remaining) }}
  </div>
</template>

<style scoped>
.content {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #fff;
  background: radial-gradient(
    ellipse at center,
    rgba(0, 0, 0, 0.75) 0%,
    rgba(0, 0, 0, 0.5) 45%,
    transparent 70%
  );
  padding: 6rem 10rem;
  white-space: nowrap;
}

.content p {
  font-weight: 900;
  font-size: 9.5rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  line-height: 1.15;
  text-shadow:
    0 0 8px #000,
    0 0 20px #000,
    0 0 40px rgba(0, 0, 0, 0.95),
    0 0 80px rgba(0, 0, 0, 0.8),
    0 0 120px rgba(0, 0, 0, 0.6);
}

.content .outline {
  color: transparent;
  font-size: 10rem;
  -webkit-text-stroke: 3px #fff;
  text-shadow: none;
  filter: drop-shadow(0 0 8px #000) drop-shadow(0 0 30px rgba(0, 0, 0, 0.8))
    drop-shadow(0 0 60px rgba(0, 0, 0, 0.5));
}

.overlay-sub {
  position: absolute;
  z-index: 1;
  left: 50%;
  top: calc(50% + 16rem);
  transform: translateX(-50%);
  text-align: center;
  font-family: 'Poppins', sans-serif;
  font-size: 3rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  color: rgba(255, 255, 255, 0.4);
  text-shadow:
    0 0 10px rgba(0, 0, 0, 0.9),
    0 0 30px rgba(0, 0, 0, 0.7);
}
</style>
