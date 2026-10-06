import {
  ICompetitorProvider,
  IRegionalStatsProvider,
  IDemandTrendProvider,
  ICostEstimateProvider,
} from '@/types/data-collection';
import { OverpassCompetitorProvider } from './competitors/overpass';
import { DemoCompetitorProvider } from './competitors/demo';
import { PbsRegionalStatsProvider } from './regional/pbs';
import { DemoRegionalStatsProvider } from './regional/demo';
import { GoogleTrendsProvider } from './trends/google-trends';
import { DemoDemandTrendProvider } from './trends/demo';
import { BenchmarkCostEstimateProvider } from './costs/benchmark';
import { DemoCostEstimateProvider } from './costs/demo';

export interface ProviderBundle {
  competitorProvider: ICompetitorProvider;
  regionalStatsProvider: IRegionalStatsProvider;
  demandTrendProvider: IDemandTrendProvider;
  costEstimateProvider: ICostEstimateProvider;
}

export function getProviderBundle(preferDemo = false): ProviderBundle {
  const forceDemo = preferDemo || process.env.FORCE_DEMO_DATA === 'true';

  if (forceDemo) {
    return {
      competitorProvider: new DemoCompetitorProvider(),
      regionalStatsProvider: new DemoRegionalStatsProvider(),
      demandTrendProvider: new DemoDemandTrendProvider(),
      costEstimateProvider: new DemoCostEstimateProvider(),
    };
  }

  return {
    competitorProvider: new OverpassCompetitorProvider(),
    regionalStatsProvider: new PbsRegionalStatsProvider(),
    demandTrendProvider: new GoogleTrendsProvider(),
    costEstimateProvider: new BenchmarkCostEstimateProvider(),
  };
}

export {
  OverpassCompetitorProvider,
  DemoCompetitorProvider,
  PbsRegionalStatsProvider,
  DemoRegionalStatsProvider,
  GoogleTrendsProvider,
  DemoDemandTrendProvider,
  BenchmarkCostEstimateProvider,
  DemoCostEstimateProvider,
};
