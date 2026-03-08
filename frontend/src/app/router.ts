import { createRouter, createWebHistory } from "vue-router";

import PromptView from "../features/prompt/PromptView.vue"
import EditorView from "../features/editor/rendering/editor.render.vue";

export const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/", redirect: "/editor" },
        { path: "/prompt", component: PromptView },
        { path: "/editor", component: EditorView },
    ],
});