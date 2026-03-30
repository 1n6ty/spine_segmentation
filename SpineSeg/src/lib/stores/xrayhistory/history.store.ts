import type { Polygon } from "$lib/utils/geometry/geometry.type";
import { writable } from "svelte/store";

export const sideXrayHistory = writable<{ past: Polygon[][], future: Polygon[][] }>({ past: [], future: [] });
export const frontalXrayHistory = writable<{ past: Polygon[][], future: Polygon[][] }>({ past: [], future: [] }); 