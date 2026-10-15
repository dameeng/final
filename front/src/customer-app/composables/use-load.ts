import { ref, onMounted, onBeforeUnmount } from "vue";
export function useLoad<T>(loader: () => Promise<T>) {
  const data = ref<T | null>(null),
    loading = ref(false),
    error = ref("");
  let version = 0,
    alive = true;
  async function reload() {
    const n = ++version;
    loading.value = true;
    error.value = "";
    data.value = null;
    try {
      const result = await loader();
      if (alive && n === version) data.value = result;
    } catch (e) {
      if (alive && n === version)
        error.value = e instanceof Error ? e.message : "불러오지 못했습니다.";
    } finally {
      if (alive && n === version) loading.value = false;
    }
  }
  onMounted(reload);
  onBeforeUnmount(() => {
    alive = false;
    version++;
  });
  return { data, loading, error, reload };
}
