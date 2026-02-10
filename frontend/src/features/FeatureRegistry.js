/**
 * Feature Registry for CleanFlow
 * 
 * Central registry for all features with metadata and routing
 */

import { Sparkles, Globe, Shuffle } from 'lucide-react';

// Import feature components
import EnrichmentBuilder from './EnrichmentBuilder';
import ScraperBuilder from './ScraperBuilder';
import SchemaMapper from './SchemaMapper';

export const FEATURE_REGISTRY = [
    {
        id: 'enrichment',
        name: 'Data Enrichment',
        description: 'Enhance your datasets with verified emails, addresses, and AI-driven attributes.',
        icon: Sparkles,
        iconColor: 'text-emerald-600',
        badge: 'New',
        category: 'transform',
        component: EnrichmentBuilder,
        requiresAuth: false,
        isPremium: false,
        path: '/features/enrichment'
    },
    {
        id: 'scraper',
        name: 'No-Code Scraping',
        description: 'Extract structured data from any website in just a few clicks—no code, no bots, no headaches.',
        icon: Globe,
        iconColor: 'text-orange-600',
        badge: 'Popular',
        category: 'extract',
        component: ScraperBuilder,
        requiresAuth: false,
        isPremium: false,
        path: '/features/scraper'
    },
    {
        id: 'mapper',
        name: 'Schema Mapping',
        description: 'Automatically map and transform messy source files into your target database schema with zero manual effort.',
        icon: Shuffle,
        iconColor: 'text-indigo-600',
        badge: 'Advanced',
        category: 'transform',
        component: SchemaMapper,
        requiresAuth: false,
        isPremium: false,
        path: '/features/mapper'
    }
];

/**
 * Get feature by ID
 */
export const getFeatureById = (id) => {
    return FEATURE_REGISTRY.find(f => f.id === id);
};

/**
 * Get features by category
 */
export const getFeaturesByCategory = (category) => {
    return FEATURE_REGISTRY.filter(f => f.category === category);
};

/**
 * Get all feature IDs
 */
export const getAllFeatureIds = () => {
    return FEATURE_REGISTRY.map(f => f.id);
};
