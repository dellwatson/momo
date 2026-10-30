// momo's fur colors. The shop sells them for points; the 3D model and the flat
// avatar both read this table. No three.js import here, so the shop page stays light.

export interface FurColor {
  id: string
  name: string
  /** Points to buy it. 0: owned from the start. */
  price: number
  root: string
  tip: string
  belly: string
  legRoot: string
  legTip: string
}

export const FURS: FurColor[] = [
  { id: 'sky', name: 'Sky', price: 0, root: '#6eafee', tip: '#c4e3fc', belly: '#a19de8', legRoot: '#93bfea', legTip: '#d7eafc' },
  { id: 'peach', name: 'Peach', price: 150, root: '#f2a07b', tip: '#fde0cf', belly: '#f3b2b8', legRoot: '#f0b394', legTip: '#fde6d8' },
  { id: 'mint', name: 'Mint', price: 150, root: '#5cc2a3', tip: '#c9f0e2', belly: '#8fd3c9', legRoot: '#86cdb6', legTip: '#d6f3e8' },
  { id: 'lilac', name: 'Lilac', price: 200, root: '#a98ae6', tip: '#e6dbfb', belly: '#d29be0', legRoot: '#b9a2e8', legTip: '#ece4fb' },
  { id: 'honey', name: 'Honey', price: 250, root: '#e8b04e', tip: '#fbe9bf', belly: '#f0c27f', legRoot: '#ebc277', legTip: '#fcefcc' },
  { id: 'night', name: 'Midnight', price: 400, root: '#3c4a8c', tip: '#8d9ad6', belly: '#6a5aa8', legRoot: '#56619c', legTip: '#a3add9' },
]

export const furById = (id?: string): FurColor => FURS.find((f) => f.id === id) ?? FURS[0]
