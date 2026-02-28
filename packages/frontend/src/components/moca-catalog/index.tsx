import { defineCatalog } from '@json-render/core';
import { schema, defineRegistry } from '@json-render/react';
import { z } from 'zod';
import DataTable from './DataTable';
import MetricCard from './MetricCard';
import Stack from './Stack';
import Grid from './Grid';

const catalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({
        gap: z.number().optional(),
      }),
      slots: ['default'],
      description: 'Vertical layout container',
    },
    Grid: {
      props: z.object({
        cols: z.number().optional(),
        gap: z.number().optional(),
      }),
      slots: ['default'],
      description: 'Grid layout container',
    },
    DataTable: {
      props: z.object({
        columns: z.array(z.string()),
        rows: z.array(z.array(z.string())),
        caption: z.string().optional(),
      }),
      slots: [],
      description: 'Table display for tabular data',
    },
    MetricCard: {
      props: z.object({
        title: z.string(),
        value: z.string(),
        description: z.string().optional(),
        change: z.string().optional(),
        changeType: z.enum(['positive', 'negative', 'neutral']).optional(),
      }),
      slots: [],
      description: 'KPI/metric display card',
    },
  },
  actions: {},
});

const { registry } = defineRegistry(catalog, {
  components: {
    Stack,
    Grid,
    DataTable,
    MetricCard,
  },
});

export { catalog, registry };

