// src/components/MetricsChart.tsx

'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Card } from '@/components/ui/card'
import { format, isFirstDayOfMonth } from 'date-fns'
import { formatCurrencyForAxis, formatConversionsForAxis } from '@/lib/utils'

type ChartType = 'line' | 'bar'

interface ChartData {
  date: string
  [key: string]: any
}

interface MetricsChartProps {
  data: ChartData[]
  metric1: {
    key: string
    label: string
    color: string
    format: (value: number) => string
  }
  metric2?: {
    key: string
    label: string
    color: string
    format: (value: number) => string
  }
  chartType?: ChartType
  barColors?: {
    [key: string]: (value: number) => string
  }
  hideControls?: boolean
}

export function MetricsChart({
  data,
  metric1,
  metric2,
  chartType: initialChartType = 'line',
  barColors,
  hideControls = false
}: MetricsChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [currentChartType, setCurrentChartType] = useState<ChartType>(initialChartType)

  useEffect(() => {
    if (!data.length || !svgRef.current) return

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove()

    // Setup dimensions
    const margin = { top: 20, right: 60, bottom: 40, left: 60 }
    const width = svgRef.current.clientWidth - margin.left - margin.right
    const height = 400 - margin.top - margin.bottom

    const svg = d3.select(svgRef.current)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Parse dates and filter labels to show only first of month
    const dates = data.map(d => new Date(d.date)).sort((a, b) => a.getTime() - b.getTime())
    const filteredDates = dates.filter((d, i) =>
      isFirstDayOfMonth(d) || i === 0 || i === dates.length - 1
    )

    // Calculate tick values based on data length
    const getTickValues = () => {
      if (data.length <= 14) return dates;  // Show all dates if 2 weeks or less
      if (data.length <= 31) return dates.filter((_, i) => i % 2 === 0);  // Show every other date if month or less
      return filteredDates;  // Show first of month for longer periods
    };

    // Setup scales
    const xScale = currentChartType === 'bar'
      ? d3.scaleBand()
        .domain(dates.map(d => format(d, 'MMM d')))
        .range([0, width])
        .padding(0.2)
      : d3.scaleTime()
        .domain(d3.extent(dates) as [Date, Date])
        .range([0, width])

    const xGroupScale = currentChartType === 'bar'
      ? d3.scaleBand()
        .domain(metric2 ? ['metric1', 'metric2'] : ['metric1'])
        .range([0, (xScale as d3.ScaleBand<string>).bandwidth()])
        .padding(0.1)
      : null

    const y1Scale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d[metric1.key] as number) || 0])
      .range([height, 0])
      .nice()

    let y2Scale
    if (metric2) {
      y2Scale = d3.scaleLinear()
        .domain([0, d3.max(data, d => d[metric2.key] as number) || 0])
        .range([height, 0])
        .nice()
    }

    // Helper function to format y-axis ticks
    const formatYAxisTick = (d: number, key: string) => {
      // Check if the metric is cost or value (currency)
      if (key.includes('cost') || key.includes('value') || key.includes('CPC') || key.includes('CPA') || key.includes('ROAS')) {
        return formatCurrencyForAxis(d, '$')
      }
      // Check if the metric is conversions
      else if (key.includes('conv')) {
        return formatConversionsForAxis(d)
      }
      // For percentage metrics
      else if (key.includes('CTR') || key.includes('CvR') || key.includes('imprShare') || key.includes('lost')) {
        return `${Math.round(d)}%`
      }
      // For other metrics (impressions, clicks)
      return d.toLocaleString('en-US', { maximumFractionDigits: 0 })
    }

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        currentChartType === 'bar'
          ? d3.axisBottom(xScale as d3.ScaleBand<string>)
            .tickValues(getTickValues().map(d => format(d, 'MMM d')))
          : d3.axisBottom(xScale as d3.ScaleTime<number, number>)
            .tickFormat(d => format(d as Date, 'MMM d'))
            .tickValues(getTickValues())
      )
      .call(g => g.select('.domain').attr('stroke', '#cbd5e1'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#cbd5e1'))
      .call(g => g.selectAll('.tick text')
        .attr('fill', '#64748b')
        .style('text-anchor', 'end')
        .attr('transform', 'rotate(-45)'))

    svg.append('g')
      .call(d3.axisLeft(y1Scale)
        .ticks(5)
        .tickFormat(d => formatYAxisTick(d as number, metric1.key)))
      .call(g => g.select('.domain').attr('stroke', '#cbd5e1'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#cbd5e1'))
      .call(g => g.selectAll('.tick text').attr('fill', '#64748b'))

    if (metric2 && y2Scale) {
      svg.append('g')
        .attr('transform', `translate(${width},0)`)
        .call(d3.axisRight(y2Scale)
          .ticks(5)
          .tickFormat(d => formatYAxisTick(d as number, metric2.key)))
        .call(g => g.select('.domain').attr('stroke', '#cbd5e1'))
        .call(g => g.selectAll('.tick line').attr('stroke', '#cbd5e1'))
        .call(g => g.selectAll('.tick text').attr('fill', '#64748b'))
    }

    if (currentChartType === 'line') {
      // Add lines
      const line1 = d3.line<ChartData>()
        .x(d => (xScale as d3.ScaleTime<number, number>)(new Date(d.date)))
        .y(d => y1Scale(d[metric1.key] as number))

      svg.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', metric1.color)
        .attr('stroke-width', 2)
        .attr('d', line1 as any) // Type assertion needed due to d3 typing limitations

      if (metric2 && y2Scale) {
        const line2 = d3.line<ChartData>()
          .x(d => (xScale as d3.ScaleTime<number, number>)(new Date(d.date)))
          .y(d => y2Scale(d[metric2.key] as number))

        svg.append('path')
          .datum(data)
          .attr('fill', 'none')
          .attr('stroke', metric2.color)
          .attr('stroke-width', 2)
          .attr('d', line2 as any) // Type assertion needed due to d3 typing limitations
      }
    } else {
      // Add bars
      const bars = svg.append('g')
        .selectAll('g')
        .data(data)
        .join('g')
        .attr('transform', d => `translate(${(xScale as d3.ScaleBand<string>)(format(new Date(d.date), 'MMM d'))},0)`)

      // Add metric1 bars
      bars.append('rect')
        .attr('x', () => xGroupScale!('metric1') || 0)
        .attr('y', d => y1Scale(d[metric1.key] as number))
        .attr('width', xGroupScale!.bandwidth())
        .attr('height', d => height - y1Scale(d[metric1.key] as number))
        .attr('fill', d => barColors?.[metric1.key]?.((d as ChartData)[metric1.key] as number) || metric1.color)
        .attr('opacity', 0.8)

      // Add metric2 bars if exists
      if (metric2 && y2Scale) {
        bars.append('rect')
          .attr('x', () => xGroupScale!('metric2') || 0)
          .attr('y', d => y2Scale(d[metric2.key] as number))
          .attr('width', xGroupScale!.bandwidth())
          .attr('height', d => height - y2Scale(d[metric2.key] as number))
          .attr('fill', d => barColors?.[metric2.key]?.((d as ChartData)[metric2.key] as number) || metric2.color)
          .attr('opacity', 0.8)
      }
    }

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - 200}, -10)`)

    const legendSymbol = currentChartType === 'line' ? 'line' : 'rect'

    if (legendSymbol === 'line') {
      legend.append('line')
        .attr('x1', 0)
        .attr('x2', 20)
        .attr('stroke', metric1.color)
        .attr('stroke-width', 2)
    } else {
      legend.append('rect')
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', barColors?.[metric1.key]?.(data[0]?.[metric1.key] as number) || metric1.color)
        .attr('opacity', 0.8)
    }

    legend.append('text')
      .attr('x', 25)
      .attr('y', legendSymbol === 'line' ? 4 : 12)
      .text(metric1.label)
      .attr('fill', '#64748b')
      .style('font-size', '12px')

    if (metric2) {
      const legend2 = legend.append('g')
        .attr('transform', 'translate(100, 0)')

      if (legendSymbol === 'line') {
        legend2.append('line')
          .attr('x1', 0)
          .attr('x2', 20)
          .attr('stroke', metric2.color)
          .attr('stroke-width', 2)
      } else {
        legend2.append('rect')
          .attr('width', 15)
          .attr('height', 15)
          .attr('fill', barColors?.[metric2.key]?.(data[0]?.[metric2.key] as number) || metric2.color)
          .attr('opacity', 0.8)
      }

      legend2.append('text')
        .attr('x', 25)
        .attr('y', legendSymbol === 'line' ? 4 : 12)
        .text(metric2.label)
        .attr('fill', '#64748b')
        .style('font-size', '12px')
    }
  }, [data, metric1, metric2, currentChartType, barColors])

  return (
    <Card className="p-4">
      {!hideControls && (
        <div className="flex justify-end mb-4">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => setCurrentChartType('line')}
              className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${currentChartType === 'line'
                ? 'bg-blue-50 text-blue-700 border-blue-700'
                : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-100'
                }`}
            >
              Line
            </button>
            <button
              type="button"
              onClick={() => setCurrentChartType('bar')}
              className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${currentChartType === 'bar'
                ? 'bg-blue-50 text-blue-700 border-blue-700'
                : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-100'
                }`}
            >
              Bar
            </button>
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        className="w-full"
        style={{ height: '400px' }}
      />
    </Card>
  )
}