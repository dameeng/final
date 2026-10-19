import seeds from '../data/my-account.json'
export function initialize(ctx) {
const { document, window, location, localStorage, sessionStorage, setTimeout, setInterval, clearTimeout, clearInterval, alert, confirm, store } = ctx;

function $(id){return document.getElementById(id);}
function toast(t){var el=$('toast');el.textContent=t;el.hidden=false;setTimeout(function(){el.hidden=true},2200);}
$('bot-fab').addEventListener('click',function(){var h=$('bot').hidden;$('bot').hidden=!h;this.setAttribute('aria-expanded',String(h));});
$('bot-x').addEventListener('click',function(){$('bot').hidden=true;});
document.addEventListener('click',function(e){var c=e.target.closest('[data-close]');if(c)$(c.dataset.close).close();});

var T=store.pageData('my-account','T',seeds.T);function show(k){T.forEach(function(x){$('s-'+x).hidden=x!==k;if(x===k)$('t-'+x).setAttribute('aria-current','page');else $('t-'+x).removeAttribute('aria-current');});}
T.forEach(function(k){$('t-'+k).addEventListener('click',function(e){e.preventDefault();show(k);history.replaceState(null,'','#'+k);});});
var h=location.hash.slice(1);if(T.indexOf(h)>-1)show(h);
document.addEventListener('click',function(e){var s=e.target.closest('[data-save]');if(s)toast(s.dataset.save);});
$('m').addEventListener('change',function(){var on=this.checked;[].forEach.call(document.querySelectorAll('.sub-sw'),function(c){c.disabled=!on;});});


return {

};
}
