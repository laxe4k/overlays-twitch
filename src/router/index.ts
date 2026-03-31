import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/intro',
      name: 'intro',
      component: () => import('@/views/IntroView.vue'),
    },
    {
      path: '/outro',
      name: 'outro',
      component: () => import('@/views/OutroView.vue'),
    },
    {
      path: '/pause',
      name: 'pause',
      component: () => import('@/views/PauseView.vue'),
    },
    {
      path: '/background',
      name: 'background',
      component: () => import('@/views/BackgroundView.vue'),
    },
    {
      path: '/background-fixe',
      name: 'background-fixe',
      component: () => import('@/views/BackgroundFixeView.vue'),
    },
    {
      path: '/',
      redirect: '/intro',
    },
  ],
})

export default router
