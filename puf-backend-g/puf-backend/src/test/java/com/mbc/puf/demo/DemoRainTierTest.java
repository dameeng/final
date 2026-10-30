package com.mbc.puf.demo;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import com.mbc.puf.common.enums.RiskLevel;
class DemoRainTierTest {
 @Test void pinnedRainIsHeavierThanWaterAndStaysUnderFiftyMillimeters(){
  // 고정 수위(cm): 관심 1.9 · 주의 4.1 · 경계 15.5(통제 15cm 기준) · 심각 30.5. 비(mm/h)는 5% 흔들려도 항상 더 크다
  double[] water={1.9,4.1,15.5,30.5};RiskLevel[] levels={RiskLevel.WATCH,RiskLevel.CAUTION,RiskLevel.ALERT,RiskLevel.SEVERE};
  double last=0;
  for(int i=0;i<levels.length;i++){
   double rain=DemoRainTier.intensity(levels[i]);
   assertTrue(rain*0.95>water[i]+0.3);assertTrue(rain*1.05<50);assertTrue(rain>last);last=rain;
   for(double acc:DemoRainTier.accumulations(rain*1.05))assertTrue(acc<=50);
   for(int h=1;h<=6;h++)assertTrue(DemoRainTier.forecast(rain,h)<=rain);
  }
 }
 @Test void safeLevelKeepsCalmRain(){assertEquals(0,DemoRainTier.intensity(RiskLevel.SAFE),0);}
}
