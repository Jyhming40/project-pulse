/// <reference types="vite/client" />

// TTF font file declarations for @react-pdf/renderer
declare module "*.ttf" {
  const src: string;
  export default src;
}
