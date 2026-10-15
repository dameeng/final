import { inject, type InjectionKey, type Ref } from 'vue';
export const waterMotionKey: InjectionKey<Ref<boolean>> = Symbol('customer-water-motion');
export function useWaterMotion() {
 const paused = inject(waterMotionKey);
 if (!paused) throw new Error('Customer water motion requires the customer layout.');
 return paused;
}
