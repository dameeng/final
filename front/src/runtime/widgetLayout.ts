import type {WidgetLayout} from '../stores/widgets'

export function widgetWidths(id:string){
 return id==='summary'?[12]:id==='map'?[6,9,12]:id==='shortcuts'?[6,12]:id==='top5'?[6,8]:[3,4,6]
}
export function widgetHeight(id:string){return id==='summary'?1:id==='map'?7:id==='shortcuts'?5:3}
export function fixedWidget(item:WidgetLayout):WidgetLayout{
 const widths=widgetWidths(item.id),w=widths.reduce((best,value)=>Math.abs(value-item.w)<Math.abs(best-item.w)?value:best)
 return {...item,w,h:widgetHeight(item.id),x:Math.min(item.x,12-w)}
}
/** Resize in the same row only, keeping every other widget in place. */
export function resizeInPlace(items:WidgetLayout[],id:string,width:number):WidgetLayout[]|null{
 const item=items.find(w=>w.id===id);if(!item||!widgetWidths(id).includes(width))return null
 const candidates=[item.x,...Array.from({length:13-width},(_,x)=>x)].filter((x,i,all)=>all.indexOf(x)===i)
 candidates.sort((a,b)=>Math.abs(a-item.x)-Math.abs(b-item.x))
 for(const x of candidates){
  if(x+width>12)continue
  const changed={...item,x,w:width,h:widgetHeight(id)}
  if(items.some(other=>other.id!==id&&x<other.x+other.w&&x+width>other.x&&changed.y<other.y+other.h&&changed.y+changed.h>other.y))continue
  return items.map(other=>other.id===id?changed:{...other})
 }
 return null
}
