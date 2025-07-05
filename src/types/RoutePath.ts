import { RegisterPages } from "./RegisterPages";


export type RoutePath<TPath extends keyof RegisterPages> = TPath;
