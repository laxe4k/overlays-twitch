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
      path: '/pause',
      name: 'pause',
      component: () => import('@/views/PauseView.vue'),
    },
    {
      path: '/outro',
      name: 'outro',
      component: () => import('@/views/OutroView.vue'),
    },
    {
      path: '/offline',
      name: 'offline',
      component: () => import('@/views/OfflineView.vue'),
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
      path: '/cg-start',
      name: 'cg-start',
      component: () => import('@/views/CGCupStartView.vue'),
    },
    {
      path: '/cg-pause',
      name: 'cg-pause',
      component: () => import('@/views/CGCupPauseView.vue'),
    },
    {
      path: '/cg-fin',
      name: 'cg-fin',
      component: () => import('@/views/CGCupFinView.vue'),
    },
    {
      path: '/error',
      name: 'error',
      component: () => import('@/views/ErrorView.vue'),
    },
    {
      path: '/',
      redirect: '/intro',
    },
  ],
})

export default router
