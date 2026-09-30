<script setup>
// Campo de senha com botão de mostrar/ocultar e, opcionalmente, as regras de senha forte.
import { ref, computed } from 'vue';
import { regrasSenha } from './acesso.js';

const props = defineProps({
  id: { type: String, required: true },
  rotulo: { type: String, default: 'Senha' },
  autocomplete: { type: String, default: 'current-password' },
  mostrarRegras: { type: Boolean, default: false },
  erro: { type: String, default: '' },
});
const modelo = defineModel({ type: String, default: '' });
const visivel = ref(false);
const regras = computed(() => regrasSenha(modelo.value));
const descricao = computed(() => [props.erro && `${props.id}-erro`, props.mostrarRegras && `${props.id}-regras`].filter(Boolean).join(' ') || undefined);
</script>

<template>
  <div>
    <label :for="id" class="acesso-rotulo">{{ rotulo }}</label>
    <div class="relative">
      <input :id="id" v-model="modelo" :type="visivel ? 'text' : 'password'" :name="autocomplete" :autocomplete="autocomplete"
        maxlength="70" class="acesso-campo pr-12" :aria-invalid="erro ? 'true' : undefined" :aria-describedby="descricao" />
      <button type="button" @click="visivel = !visivel" :aria-label="visivel ? 'Ocultar senha' : 'Mostrar senha'" :aria-pressed="visivel"
        class="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg acesso-foco">
        <i :class="visivel ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i>
      </button>
    </div>
    <p v-if="erro" :id="`${id}-erro`" class="acesso-erro-campo">{{ erro }}</p>
    <ul v-if="mostrarRegras" :id="`${id}-regras`" class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Regras da senha">
      <li v-for="r in regras" :key="r.texto" :class="r.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'">
        <i :class="['pi text-xs mr-1', r.ok ? 'pi-check' : 'pi-circle']" aria-hidden="true"></i>{{ r.texto }}<span class="sr-only">{{ r.ok ? ': atendida' : ': pendente' }}</span>
      </li>
    </ul>
  </div>
</template>
