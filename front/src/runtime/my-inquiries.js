export function initialize(ctx) {
const { document, window, location, localStorage, sessionStorage, setTimeout, setInterval, clearTimeout, clearInterval, alert, confirm, store } = ctx;

function $(id){return document.getElementById(id);}
function toast(t){var el=$('toast');el.textContent=t;el.hidden=false;setTimeout(function(){el.hidden=true},2200);}
$('bot-fab').addEventListener('click',function(){var h=$('bot').hidden;$('bot').hidden=!h;this.setAttribute('aria-expanded',String(h));});
$('bot-x').addEventListener('click',function(){$('bot').hidden=true;});
document.addEventListener('click',function(e){var c=e.target.closest('[data-close]');if(c)$(c.dataset.close).close();});
document.addEventListener('click',function(e){var t=e.target.closest('.tg');if(!t)return;var d=$('d'+t.dataset.i);d.hidden=!d.hidden;t.setAttribute('aria-expanded',String(!d.hidden));});

return {

};
}
