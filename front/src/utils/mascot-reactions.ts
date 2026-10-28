export type MascotExpression = 'normal' | 'ouch' | 'wink' | 'dizzy'
export type MascotAction = 'recoil' | 'bounce' | 'greet' | 'dance' | 'bow' | 'spin' | 'dizzy' | 'sway' | 'cuddle'
export const mascotActions: MascotAction[] = ['recoil', 'bounce', 'greet', 'dance', 'bow', 'spin']
export const mascotReactions: Record<MascotAction, {expression:MascotExpression;text:string;mark:string;motion:string[]}> = {
  recoil:{expression:'ouch',text:'앗! 살살 눌러 주세요~',mark:'!',motion:['translateX(-9px) rotate(-16deg) scale(1.08,.9)','translateX(10px) rotate(15deg)','translateX(-6px) rotate(-9deg)','translateX(3px) rotate(4deg)']},
  bounce:{expression:'wink',text:'통통! 루랑 놀아 줄래요?',mark:'♪',motion:['translateY(3px) scale(1.1,.9)','translateY(-18px) scale(.94,1.07)','translateY(1px) scale(1.06,.94)','translateY(-7px)']},
  greet:{expression:'wink',text:'안녕! 루가 여기 있어요!',mark:'✦',motion:['rotate(-13deg)','rotate(14deg) translateY(-4px)','rotate(-12deg)','rotate(7deg)']},
  dance:{expression:'wink',text:'왼쪽~ 오른쪽~ 신나요!',mark:'♫',motion:['translateX(-12px) rotate(-12deg)','translateX(12px) rotate(12deg)','translateX(-10px) rotate(-10deg)','translateX(8px) rotate(8deg)']},
  bow:{expression:'wink',text:'안전한 길, 루가 도와드릴게요!',mark:'♡',motion:['translateY(5px) scale(1.05,.87)','translateY(6px) scale(1.04,.85)','translateY(-3px) scale(.98,1.03)']},
  spin:{expression:'wink',text:'빙그르르~ 짠!',mark:'✦',motion:['rotate(-15deg) scale(.95)','rotate(120deg) scale(.9)','rotate(260deg) scale(.94)','rotate(360deg)']},
  dizzy:{expression:'dizzy',text:'어질어질~ 잠깐만요!',mark:'…',motion:['translateX(-10px) rotate(-20deg)','translateX(11px) rotate(22deg)','translateX(-8px) rotate(-14deg)','translateX(5px) rotate(9deg)']},
  sway:{expression:'dizzy',text:'으앗! 천천히 옮겨 주세요~',mark:'!',motion:['translateX(-10px) rotate(-24deg)','translateX(12px) rotate(23deg)','translateX(-7px) rotate(-14deg)','rotate(6deg)']},
  cuddle:{expression:'wink',text:'꼬옥~ 포근해요!',mark:'♡',motion:['rotate(-6deg) scale(1.04)','rotate(6deg) scale(1.04)','rotate(-4deg)','rotate(3deg)']},
}
