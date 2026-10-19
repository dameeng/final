import {fixedWidget,widgetWidths,widgetHeight,resizeInPlace} from './widgetLayout'
import {GridStack} from 'gridstack'
import {watch} from 'vue'
import {useWidgets,type WidgetLayout} from '../stores/widgets'

const catalog=[
 {id:'summary',label:'담당 시설 요약',w:12,h:2},
 {id:'events',label:'최근 이벤트 타임라인',w:3,h:8},
 {id:'map',label:'지하차도 지도',w:9,h:8},
 {id:'top5',label:'예지보전 TOP 5',w:8,h:4},
 {id:'todo',label:'점검 필요',w:4,h:4},
 {id:'verify',label:'수동 판별 대기',w:6,h:2},
 {id:'shortcuts',label:'관리자 페이지 바로가기',w:12,h:5},
 {id:'health',label:'데이터 수신 상태',w:6,h:2},
]

export function mountWidgets(root:HTMLElement,ctx:any){
 const store=useWidgets(),container=root.querySelector<HTMLElement>('#grid')!,originals=new Map<string,HTMLElement>(),all:WidgetLayout[]=[]
 container.querySelectorAll('.ctl').forEach(el=>el.remove())
 const frame=document.createElement('div');frame.className='widget-layout-frame';container.before(frame);frame.append(container)
 const picker=document.createElement('aside');picker.className='widget-picker';picker.hidden=true;picker.setAttribute('aria-label','위젯 관리');frame.prepend(picker)
 let pickerOpen=false
 const pickerHead=document.createElement('div');pickerHead.className='widget-picker-header';pickerHead.setAttribute('aria-label','제목 표시줄을 끌어 창 이동');const title=document.createElement('h2');title.textContent='⠿ 위젯 관리';const closePicker=document.createElement('button');closePicker.type='button';closePicker.className='widget-picker-close';closePicker.textContent='닫기';pickerHead.append(title,closePicker);picker.append(pickerHead)
 let pickerPositionKey='routel-widget-picker-position:'+ctx.store.roleKey,pickerPosition:{left:number;top:number}|null=null,dragOffset:{pointerId:number;x:number;y:number}|null=null
 function applyPickerPosition(left:number,top:number,persist=false){const width=picker.offsetWidth||Math.min(380,window.innerWidth-32),height=picker.offsetHeight||180;const maxLeft=Math.max(8,window.innerWidth-width-8),maxTop=Math.max(8,window.innerHeight-height-8);pickerPosition={left:Math.max(8,Math.min(maxLeft,left)),top:Math.max(8,Math.min(maxTop,top))};picker.style.left=pickerPosition.left+'px';picker.style.top=pickerPosition.top+'px';picker.style.right='auto';if(persist)try{localStorage.setItem(pickerPositionKey,JSON.stringify(pickerPosition))}catch{}}
 function restorePickerPosition(){pickerPositionKey='routel-widget-picker-position:'+ctx.store.roleKey;pickerPosition=null;picker.style.left='';picker.style.top='';picker.style.right='';try{const value=JSON.parse(localStorage.getItem(pickerPositionKey)||'null');if(Number.isFinite(value?.left)&&Number.isFinite(value?.top)){pickerPosition={left:value.left,top:value.top};picker.style.left=value.left+'px';picker.style.top=value.top+'px';picker.style.right='auto'}}catch{}}
 restorePickerPosition()
 const hint=document.createElement('p');hint.textContent='제목의 ⠿ 손잡이로 위치를 옮기세요. 크기는 정해진 단계로만 바뀌며, 같은 줄에 공간이 부족하면 현재 배치를 유지합니다.';picker.append(hint)
 const rows=new Map<string,{check:HTMLInputElement;size:HTMLSelectElement}>()
 container.querySelectorAll<HTMLElement>(':scope>.grid-stack-item').forEach(el=>{
  const id=el.getAttribute('gs-id')!,w=Number(el.getAttribute('gs-w')),h=Number(el.getAttribute('gs-h'))
  originals.set(id,el);all.push({id,x:Number(el.getAttribute('gs-x')),y:Number(el.getAttribute('gs-y')),w,h})
  const header=el.querySelector<HTMLElement>('.widget-original-content h2'),dragBar=header?.closest<HTMLElement>('.wg-head,.map-top')
  if(header&&dragBar){dragBar.classList.add('widget-drag-handle');const grip=document.createElement('span');grip.className='widget-drag-grip widget-edit-controls';grip.textContent='⠿';grip.setAttribute('aria-hidden','true');const remove=document.createElement('button');remove.type='button';remove.className='widget-remove-button widget-edit-controls';remove.dataset.widgetId=id;remove.textContent='×';remove.setAttribute('aria-label',(catalog.find(x=>x.id===id)?.label||id)+' 위젯 제거');header.prepend(remove);header.prepend(grip)}
 })
 const defaults:WidgetLayout[]=[
  {id:'summary',x:0,y:0,w:12,h:1},
  {id:'map',x:0,y:1,w:9,h:7},{id:'events',x:9,y:1,w:3,h:3},{id:'todo',x:9,y:4,w:3,h:3},
  {id:'top5',x:0,y:8,w:6,h:3},{id:'verify',x:6,y:8,w:3,h:3},{id:'health',x:9,y:8,w:3,h:3},
 ]
 let key='routel-widgets-v6:'+ctx.store.roleKey;store.load(key,defaults)
 const previousDefault={summary:[0,0,12,1],map:[0,1,8,6],events:[8,1,4,3],todo:[8,4,4,3],top5:[0,7,6,3],verify:[6,7,3,3],health:[9,7,3,3]} as Record<string,number[]>
 const legacy={summary:[0,0,12,2],events:[0,2,3,8],map:[3,2,9,8],top5:[0,10,8,4],todo:[8,10,4,4],verify:[0,14,6,2],health:[6,14,6,2]} as Record<string,number[]>
 if(store.saved.length===7&&store.saved.every(w=>JSON.stringify([w.x,w.y,w.w,w.h])===JSON.stringify(legacy[w.id]))||store.saved.length===7&&store.saved.every(w=>JSON.stringify([w.x,w.y,w.w,w.h])===JSON.stringify(previousDefault[w.id])))store.saved=structuredClone(defaults)
 const grid=GridStack.init({column:12,float:true,cellHeight:Math.max(56,Math.min(80,(window.innerHeight-260)/11)),margin:8,animate:false,draggable:{handle:'.widget-drag-handle',cancel:'a,button,input,select,textarea,option'},disableDrag:true,disableResize:true,columnOpts:{breakpoints:[{w:700,c:1},{w:1050,c:6}]}},container)
 let sync=false
 const empty=document.createElement('p');empty.className='widget-empty';empty.textContent='표시 중인 위젯이 없습니다. 위젯 관리에서 항목을 선택해 주세요.';container.after(empty)
 function capture(){
  if(window.innerWidth<=1050){
   const base=store.editing?store.draft:store.saved
   const nodes=[...grid.engine.nodes].sort((a,b)=>a.y!-b.y!)
   const ordered=[...base].sort((a,b)=>a.y-b.y||a.x-b.x)
   if(nodes.every((node,index)=>node.id===ordered[index]?.id))return JSON.parse(JSON.stringify(base)) as WidgetLayout[]
   let y=0
   return nodes.map(node=>{const item=base.find(w=>w.id===node.id)!;const next={...item,x:0,y,h:widgetHeight(item.id)};y+=next.h;return next})
  }
  const columns=grid.getColumn();return grid.engine.nodes.map(n=>({id:n.id!,x:Math.round(n.x!*12/columns),y:n.y!,w:Math.max(minWidth(n.id!),Math.round(n.w!*12/columns)),h:widgetHeight(n.id!)}))
 }
 function minWidth(id:string){return id==='summary'||id==='map'||id==='top5'?6:3}
 function syncRows(items:WidgetLayout[]){
  rows.forEach((row,id)=>{const item=items.find(w=>w.id===id);row.check.checked=!!item;row.size.disabled=window.innerWidth<=1050||!item||widgetWidths(id).length===1;if(item){row.size.value=String(item.w)}})
 }
 function render(items:WidgetLayout[]){
  sync=true;grid.batchUpdate();[...grid.engine.nodes].forEach(n=>{if(n.el)grid.removeWidget(n.el,false,false)});originals.forEach(el=>el.remove())
  let compactY=0
  const compact=window.innerWidth<=1050
  const ordered=[...items].sort((a,b)=>a.y-b.y||a.x-b.x)
  ordered.forEach(w=>{const el=originals.get(w.id);if(el){const height=compact?(w.id==='summary'?2:w.id==='map'?14:w.id==='top5'?5:Math.max(3,w.h)):widgetHeight(w.id);container.append(el);grid.makeWidget(el,{...w,...(compact?{x:0,y:compactY,w:grid.getColumn()}:{}),h:height,minW:Math.min(grid.getColumn(),minWidth(w.id)),minH:height,maxH:height,noResize:true});compactY+=height}})
  grid.batchUpdate(false);grid.enableMove(store.editing);grid.enableResize(false)
  root.classList.toggle('editing',store.editing);frame.classList.toggle('editing',store.editing)
  picker.hidden=!store.editing||!pickerOpen
  ;(root.querySelector('#editbar') as HTMLElement).hidden=!store.editing;(root.querySelector('#edit-on') as HTMLElement).hidden=store.editing
  syncRows(items);empty.hidden=items.length>0;sync=false
 }
 catalog.forEach(spec=>{
  const row=document.createElement('div');row.className='widget-picker-row'
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.setAttribute('aria-label',spec.label+' 표시');label.append(check,document.createTextNode(spec.label));row.append(label)
  const size=document.createElement('select');size.setAttribute('aria-label',spec.label+' 너비')
  const widths=widgetWidths(spec.id)
  widths.forEach((width,index)=>{const option=document.createElement('option');option.value=String(width);option.textContent=widths.length===1?'고정':widths.length===2?(index===0?'기본':'크게'):['작게','기본','크게'][index]!;size.append(option)})
  row.append(size);picker.append(row);rows.set(spec.id,{check,size})
  ctx.on(check,'change',()=>{if(!store.editing)store.begin();let items=JSON.parse(JSON.stringify(store.draft)) as WidgetLayout[];if(check.checked&&!items.some(w=>w.id===spec.id)){const base=defaults.find(w=>w.id===spec.id)||{id:spec.id,x:0,y:0,w:spec.w,h:spec.h};const bottom=items.reduce((value,w)=>Math.max(value,w.y+w.h),0);items.push({...base,y:bottom})}else if(!check.checked)items=items.filter(w=>w.id!==spec.id);store.draft=items;render(store.draft)})
  ctx.on(size,'change',()=>{if(!store.editing)return;const next=resizeInPlace(capture(),spec.id,Number(size.value));if(!next){syncRows(store.draft);ctx.notify('같은 줄에 공간이 부족합니다. 옆 위젯을 먼저 옮겨 주세요.');return}store.draft=next;render(store.draft)})
 })
 ctx.on(container,'click',(event:Event)=>{const button=(event.target as Element).closest<HTMLButtonElement>('.widget-remove-button');if(!button)return;event.preventDefault();event.stopPropagation();if(!store.editing)store.begin();store.draft=store.draft.filter(item=>item.id!==button.dataset.widgetId);render(store.draft)})
 ctx.on(pickerHead,'pointerdown',(event:Event)=>{const e=event as PointerEvent;if(e.button!==0||(e.target as Element).closest('button'))return;const rect=picker.getBoundingClientRect();dragOffset={pointerId:e.pointerId,x:e.clientX-rect.left,y:e.clientY-rect.top};pickerHead.setPointerCapture(e.pointerId);e.preventDefault()})
 ctx.on(pickerHead,'pointermove',(event:Event)=>{const e=event as PointerEvent;if(!dragOffset||dragOffset.pointerId!==e.pointerId)return;applyPickerPosition(e.clientX-dragOffset.x,e.clientY-dragOffset.y)})
 ctx.on(pickerHead,'pointerup',(event:Event)=>{const e=event as PointerEvent;if(!dragOffset||dragOffset.pointerId!==e.pointerId)return;dragOffset=null;if(pickerPosition)applyPickerPosition(pickerPosition.left,pickerPosition.top,true)})
 ctx.on(window,'resize',()=>{if(!picker.hidden&&pickerPosition)applyPickerPosition(pickerPosition.left,pickerPosition.top,true)})
 ctx.on(closePicker,'click',()=>{pickerOpen=false;picker.hidden=true;(root.querySelector('#widget-add') as HTMLElement)?.focus()})
 function remember(){if(store.editing)store.draft=capture()}
 grid.on('change',()=>{if(sync||!store.editing)return;store.draft=capture()})
 ctx.on(root.querySelector('#edit-on')!,'click',()=>{pickerOpen=false;store.begin();render(store.draft);if(pickerPosition)applyPickerPosition(pickerPosition.left,pickerPosition.top)})
 const cancel=root.querySelector('#widget-cancel');if(cancel)ctx.on(cancel,'click',()=>{store.cancel();render(store.saved)})
 ctx.on(root.querySelector('#reset')!,'click',()=>{store.draft=structuredClone(defaults);store.save(key);store.begin();render(store.draft);ctx.notify('기본 위젯 배치로 초기화하고 저장했습니다.')})
 const save=()=>{remember();store.save(key)}
 ctx.on(root.querySelector('#done')!,'click',()=>{try{save();render(store.saved);ctx.notify('위젯 배치를 저장했습니다.')}catch{ctx.notify('저장하지 못했습니다. 편집 내용은 유지됩니다.')}})
 const add=root.querySelector<HTMLElement>('#widget-add');if(add){ctx.on(add,'click',()=>{pickerOpen=true;picker.hidden=false;if(pickerPosition)applyPickerPosition(pickerPosition.left,pickerPosition.top);rows.values().next().value?.check.focus()})}
 let compactLayout=window.innerWidth<=1050
 ctx.on(window,'resize',()=>{const compact=window.innerWidth<=1050;if(compact!==compactLayout){compactLayout=compact;render(store.editing?store.draft:store.saved)}})
 const stop=watch(()=>ctx.store.roleKey,(role:string)=>{store.cancel();key='routel-widgets-v6:'+role;restorePickerPosition();store.load(key,defaults);store.saved=store.saved.map(fixedWidget);render(store.saved)})
 store.saved=store.saved.map(fixedWidget)
 render(store.saved)
 return {isEditing:()=>store.editing,save:()=>{if(store.editing){try{save()}catch{}}},dispose:()=>{stop();grid.destroy(false);store.cancel()}}
}
