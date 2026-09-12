import './style.css'
import { boot } from './game.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app saknas')
boot(app)
