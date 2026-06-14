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
      path: '/cg-intro',
      name: 'cg-intro',
      component: () => import('@/views/cgcup-summer/IntroView.vue'),
    },
    {
      path: '/cg-pause',
      name: 'cg-pause',
      component: () => import('@/views/cgcup-summer/PauseView.vue'),
    },
    {
      path: '/cg-outro',
      name: 'cg-outro',
      component: () => import('@/views/cgcup-summer/OutroView.vue'),
    },
    {
      path: '/cg-error',
      name: 'cg-error',
      component: () => import('@/views/cgcup-summer/ErrorView.vue'),
    },
    {
      path: '/',
      redirect: '/intro',
    },
  ],
})

export default router
