import { Portfolio, PortfolioHolding } from "../types";
import { safeLocalStorage } from "./storage/safeStorage";

export class PortfolioService {
  private static instance: PortfolioService;
  private portfolios: Portfolio[] = [];
  private readonly STORAGE_KEY = "athena_portfolios";

  private constructor() {
    this.load();
    if (this.portfolios.length === 0) {
      this.createDefaultPortfolio();
    }
  }

  public static getInstance(): PortfolioService {
    if (!PortfolioService.instance) {
      PortfolioService.instance = new PortfolioService();
    }
    return PortfolioService.instance;
  }

  private load() {
    const saved = safeLocalStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        this.portfolios = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to load portfolios", e);
        this.portfolios = [];
      }
    }
  }

  private save() {
    safeLocalStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.portfolios));
  }

  private createDefaultPortfolio() {
    const defaultPortfolio: Portfolio = {
      id: "main-portfolio",
      name: "Long Term Core",
      holdings: [
        {
          symbol: "RELIANCE",
          quantity: 100,
          averagePrice: 2450,
          investmentAmount: 245000,
          sector: "Energy/Conglomerate",
          purchaseDate: "2024-01-15",
          notes: "Core energy holding with green energy pivot."
        },
        {
          symbol: "TCS",
          quantity: 50,
          averagePrice: 3200,
          investmentAmount: 160000,
          sector: "Information Technology",
          purchaseDate: "2023-11-20",
          notes: "Defensive IT play with strong dividends."
        }
      ],
      createdAt: new Date().toISOString()
    };
    this.portfolios = [defaultPortfolio];
    this.save();
  }

  public getPortfolios(): Portfolio[] {
    return [...this.portfolios];
  }

  public createPortfolio(name: string): Portfolio {
    const newPortfolio: Portfolio = {
      id: Math.random().toString(36).substring(7),
      name,
      holdings: [],
      createdAt: new Date().toISOString()
    };
    this.portfolios.push(newPortfolio);
    this.save();
    return newPortfolio;
  }

  public updatePortfolio(id: string, updates: Partial<Portfolio>) {
    const idx = this.portfolios.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.portfolios[idx] = { ...this.portfolios[idx], ...updates };
      this.save();
    }
  }

  public addHolding(portfolioId: string, holding: PortfolioHolding) {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    if (portfolio) {
      portfolio.holdings.push(holding);
      this.save();
    }
  }

  public removeHolding(portfolioId: string, symbol: string) {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    if (portfolio) {
      portfolio.holdings = portfolio.holdings.filter(h => h.symbol !== symbol);
      this.save();
    }
  }

  public getHoldings(portfolioId: string): PortfolioHolding[] {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    return portfolio ? [...portfolio.holdings] : [];
  }
}
