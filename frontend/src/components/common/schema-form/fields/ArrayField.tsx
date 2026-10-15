/**
 * Re-exporta `ArrayFieldCard` bajo el nombre `ArrayField` para mantener
 * coherencia con la nomenclatura del subdirectorio `fields/`.
 * El componente real vive en `../ArrayFieldCard` para preservar
 * la historia de git sin ruptura de imports externos.
 */
export { ArrayFieldCard as ArrayField } from '../ArrayFieldCard';
