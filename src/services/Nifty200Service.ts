import { CompanyKnowledge } from "../types";
import { supabaseAdmin } from "../lib/supabase";

export interface Nifty200Company {
  symbol: string;
  name: string;
  industry: string;
  lastUpdated: string;
}

export class Nifty200Service {
  private static instance: Nifty200Service;
  private constituentList: Nifty200Company[] = [];
  private isMonitoring: boolean = false;

  private constructor() {
    this.loadConstituents();
  }

  public static getInstance(): Nifty200Service {
    if (!Nifty200Service.instance) {
      Nifty200Service.instance = new Nifty200Service();
    }
    return Nifty200Service.instance;
  }

  private loadConstituents(): void {
    // In production, this would fetch from NSE/BSE.
    this.constituentList = [
      { symbol: "RELIANCE", name: "Reliance Industries", industry: "Oil & Gas", lastUpdated: new Date().toISOString() },
      { symbol: "TCS", name: "Tata Consultancy Services", industry: "IT", lastUpdated: new Date().toISOString() },
      { symbol: "INFY", name: "Infosys", industry: "IT", lastUpdated: new Date().toISOString() },
      { symbol: "HDFCBANK", name: "HDFC Bank", industry: "Banking", lastUpdated: new Date().toISOString() },
      { symbol: "ICICIBANK", name: "ICICI Bank", industry: "Banking", lastUpdated: new Date().toISOString() },
    ];
  }

  public getConstituents(): Nifty200Company[] {
    return this.constituentList;
  }

  public async startMonitoring(): Promise<void> {
    this.isMonitoring = true;
    console.log("[Nifty200Service] Monitoring started for", this.constituentList.length, "companies.");
    
    // Log start event to Supabase
    await supabaseAdmin.from('nifty200_events').insert({
      symbol: 'SYSTEM',
      company: 'Nifty 200 Index',
      priority: 'Low',
      event_id: 'MONITORING_STARTED'
    });
  }

  public async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    console.log("[Nifty200Service] Monitoring stopped.");

    await supabaseAdmin.from('nifty200_events').insert({
      symbol: 'SYSTEM',
      company: 'Nifty 200 Index',
      priority: 'Low',
      event_id: 'MONITORING_STOPPED'
    });
  }

  public getMonitoringStatus(): boolean {
    return this.isMonitoring;
  }
}
