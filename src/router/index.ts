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
      path: '/cgcup-summer-intro',
      name: 'cgcup-summer-intro',
      component: () => import('@/views/cgcup-summer/IntroView.vue'),
    },
    {
      path: '/cgcup-summer-pause',
      name: 'cgcup-summer-pause',
      component: () => import('@/views/cgcup-summer/PauseView.vue'),
    },
    {
      path: '/cgcup-summer-outro',
      name: 'cgcup-summer-outro',
      component: () => import('@/views/cgcup-summer/OutroView.vue'),
    },
    {
      path: '/cgcup-summer-error',
      name: 'cgcup-summer-error',
      component: () => import('@/views/cgcup-summer/ErrorView.vue'),
    },
    {
      path: '/cgcup-intro',
      name: 'cgcup-intro',
      component: () => import('@/views/cgcup/IntroView.vue'),
    },
    {
      path: '/cgcup-pause',
      name: 'cgcup-pause',
      component: () => import('@/views/cgcup/PauseView.vue'),
    },
    {
      path: '/cgcup-outro',
      name: 'cgcup-outro',
      component: () => import('@/views/cgcup/OutroView.vue'),
    },
    {
      path: '/cgcup-error',
      name: 'cgcup-error',
      component: () => import('@/views/cgcup/ErrorView.vue'),
    },
    {
      path: '/',
      redirect: '/intro',
    },
  ],
})

export default router
