package com.mbc.puf.demo;

import java.util.OptionalDouble;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import com.mbc.puf.underpass.repository.UnderpassRepository;

/** 시연 수위 생성에만 적용한다. 실제 점수/단계 판단 및 모델 입력은 변경하지 않는다. */
@Component
@ConditionalOnProperty(name="puf.demo.enabled",havingValue="true")
public class DemoWaterProfile {
    private final UnderpassRepository underpasses;
    private final double referenceBlock;
    private final double severeExtra;
    private final Map<Long,Double> levels=new ConcurrentHashMap<>();
    public DemoWaterProfile(UnderpassRepository underpasses,
            @Value("${puf.risk.water.default-block-cm:15}") double referenceBlock,
            @Value("${puf.risk.water.severe-extra-cm:15}") double severeExtra) {
        this.underpasses=underpasses;this.referenceBlock=referenceBlock;this.severeExtra=severeExtra;
    }
    public OptionalDouble sample(Long id,boolean due,double scenarioWater) {
        var u=underpasses.findByIdAndDeletedFalse(id).orElse(null);
        if(u==null)return OptionalDouble.empty();
        double score=u.getCurrentRiskScore()==null?0:u.getCurrentRiskScore().doubleValue();
        double previous=levels.getOrDefault(id,u.getCurrentWaterCm()==null?0:u.getCurrentWaterCm().doubleValue());
        if(!due&&score<70&&previous<=0.5)return OptionalDouble.empty();
        // 모든 지하차도에 동일한 물리 수위 곡선. 5cm 대상은 15cm 대상보다 먼저 차단된다.
        double target=Math.max(scenarioWater,target(score,referenceBlock,severeExtra));
        double next=target>=previous?target:Math.max(target,previous-2.0);
        levels.put(id,next);
        return OptionalDouble.of(next);
    }
    static double target(double score,double block,double extra) {
        double s=Math.max(0,Math.min(100,score));
        double[] x={0,40,70,85,95,100};
        double[] y={0.2,block*0.15,block*0.6,block,block+extra,block+extra+3};
        for(int i=1;i<x.length;i++)if(s<=x[i])return y[i-1]+(y[i]-y[i-1])*(s-x[i-1])/(x[i]-x[i-1]);
        return y[y.length-1];
    }
}
