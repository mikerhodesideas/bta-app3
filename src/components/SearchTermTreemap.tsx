'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { Card } from '@/components/ui/card'

interface SearchTermData {
    name: string
    impr: number
    clicks: number
    cost: number
    conv: number
    value: number
    ctr: number
    cvr: number
    cpa: number
    roas: number
    children?: SearchTermData[]
    [key: string]: number | string | SearchTermData[] | undefined
}

type TreemapNode = d3.HierarchyRectangularNode<SearchTermData>

interface SearchTermTreemapProps {
    data: SearchTermData
    sizeMetric: string
    colorMetric: string
}

export function SearchTermTreemap({ data, sizeMetric, colorMetric }: SearchTermTreemapProps) {
    const svgRef = useRef<SVGSVGElement>(null)

    useEffect(() => {
        if (!svgRef.current || !data) return

        const width = 928
        const height = 462

        // Clear existing content
        d3.select(svgRef.current).selectAll("*").remove()

        // Create color scale based on metric
        const colorScale = d3.scaleSequential()
            .domain(getColorDomain(colorMetric))
            .interpolator(d3.interpolateRdYlGn)

        // Custom tiling function for appropriate aspect ratio when zoomed
        function tile(node: TreemapNode, x0: number, y0: number, x1: number, y1: number) {
            d3.treemapBinary(node, 0, 0, width, height)
            for (const child of node.children || []) {
                const c = child as TreemapNode
                c.x0 = x0 + (c.x0 / width) * (x1 - x0)
                c.x1 = x0 + (c.x1 / width) * (x1 - x0)
                c.y0 = y0 + (c.y0 / height) * (y1 - y0)
                c.y1 = y0 + (c.y1 / height) * (y1 - y0)
            }
        }

        // Compute the layout
        const hierarchy = d3.hierarchy(data)
            .sum(d => d[sizeMetric] as number || 0)
            .sort((a, b) => (b.value || 0) - (a.value || 0))

        // Create scales
        const x = d3.scaleLinear().rangeRound([0, width])
        const y = d3.scaleLinear().rangeRound([0, height])

        // Initialize treemap layout
        const treemap = d3.treemap<SearchTermData>()
            .size([width, height])
            .paddingTop(30)
            .paddingRight(3)
            .paddingInner(1)
            .tile(tile as any)

        const root = treemap(hierarchy) as TreemapNode

        // Set initial domains
        x.domain([root.x0, root.x1])
        y.domain([root.y0, root.y1])

        // Formatting utilities
        const format = d3.format(",d")
        const formatPercent = d3.format(".1%")
        const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val)

        const formatMetricValue = (metric: string, value: number) => {
            if (['ctr', 'cvr'].includes(metric)) return `${(value * 100).toFixed(1)}%`
            if (['cost', 'cpa', 'value'].includes(metric)) return formatCurrency(value)
            if (metric === 'roas') return value.toFixed(2) + 'x'
            return format(value)
        }

        const name = (d: TreemapNode) =>
            d.ancestors().reverse().map(d => d.data.name).join("/")

        // Create SVG container
        const svg = d3.select(svgRef.current)
            .attr("viewBox", [0.5, -30.5, width, height + 30])
            .attr("width", width)
            .attr("height", height + 30)
            .attr("style", "max-width: 100%; height: auto;")
            .style("font", "10px sans-serif")

        let group = svg.append("g")

        function render(group: d3.Selection<SVGGElement, unknown, null, undefined>, root: TreemapNode) {
            const node = group
                .selectAll<SVGGElement, TreemapNode>("g")
                .data(root.children || [])
                .join("g")

            // Create the root label separately
            if (root === hierarchy) {
                group.append("g")
                    .attr("transform", `translate(0,-30)`)
                    .append("text")
                    .attr("font-weight", "bold")
                    .attr("font-size", "11px")
                    .selectAll("tspan")
                    .data(() => {
                        const lines = [root.data.name]
                        if (root.value) {
                            const sizeValue = formatMetricValue(sizeMetric, root.value)
                            const percentage = "100.0"
                            lines.push(`${sizeValue} (${percentage}%)`)
                        }
                        return lines
                    })
                    .join("tspan")
                    .attr("x", 3)
                    .attr("y", (d, i) => `${1.1 + i * 0.9}em`)
                    .text(d => d)
            }

            node.filter(d => d.children !== undefined)
                .attr("cursor", "pointer")
                .on("click", (event, d) => zoomin(d))

            node.append("title")
                .text(d => {
                    const totalValue = root.value || 1
                    const percentage = ((d.value || 0) / totalValue * 100).toFixed(1)
                    return `${name(d)}
${sizeMetric}: ${formatMetricValue(sizeMetric, d.value || 0)} (${percentage}%)
${colorMetric}: ${formatMetricValue(colorMetric, d.data[colorMetric] as number)}`
                })

            node.append("rect")
                .attr("fill", d => colorScale(d.data[colorMetric] as number))
                .attr("stroke", "#fff")

            const text = node.append("text")
                .attr("font-size", "11px")

            text.selectAll("tspan")
                .data(d => {
                    const lines = [d.data.name]
                    if (d.value) {
                        const sizeValue = formatMetricValue(sizeMetric, d.value)
                        const totalValue = root.value || 1
                        const percentage = ((d.value / totalValue) * 100).toFixed(1)
                        lines.push(`${sizeValue} (${percentage}%)`)
                    }
                    return lines
                })
                .join("tspan")
                .attr("x", 3)
                .attr("y", (d, i, nodes) => `${(i === nodes.length - 1 ? 0.3 : 0) + 1.1 + i * 0.9}em`)
                .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : null)
                .text(d => d)

            position(group)
            return group
        }

        function position(group: d3.Selection<SVGGElement, unknown, null, undefined>) {
            group.selectAll<SVGGElement, TreemapNode>("g")
                .attr("transform", d => {
                    if (typeof d?.x0 === 'undefined' || typeof d?.y0 === 'undefined') return ''
                    return `translate(${x(d.x0)},${y(d.y0)})`
                })
                .select<SVGRectElement>("rect")
                .attr("width", d => {
                    if (typeof d?.x0 === 'undefined' || typeof d?.x1 === 'undefined') return 0
                    return x(d.x1) - x(d.x0)
                })
                .attr("height", d => {
                    if (typeof d?.y0 === 'undefined' || typeof d?.y1 === 'undefined') return 0
                    return y(d.y1) - y(d.y0)
                })
        }

        function zoomin(d: TreemapNode) {
            const group0 = group.attr("pointer-events", "none")
            const group1 = group = svg.append("g")
            render(group1, d)

            x.domain([d.x0, d.x1])
            y.domain([d.y0, d.y1])

            // Handle exit
            group0
                .style("opacity", 1)
                .transition()
                .duration(750)
                .style("opacity", 0)
                .remove()

            // Handle enter
            group1
                .style("opacity", 0)
                .transition()
                .duration(750)
                .style("opacity", 1)

            // Update positions
            position(group0)
            position(group1)
        }

        function zoomout(d: TreemapNode) {
            const group0 = group.attr("pointer-events", "none")
            const group1 = group = svg.insert("g", "*")
            render(group1, d.parent as TreemapNode)

            const parent = d.parent as TreemapNode
            x.domain([parent.x0, parent.x1])
            y.domain([parent.y0, parent.y1])

            // Handle exit
            group0
                .style("opacity", 1)
                .transition()
                .duration(750)
                .style("opacity", 0)
                .remove()

            // Handle enter
            group1
                .transition()
                .duration(750)
                .style("opacity", 1)

            // Update positions
            position(group0)
            position(group1)
        }

        // Helper function to get color domain based on metric
        function getColorDomain(metric: string): [number, number] {
            switch (metric) {
                case 'ctr': return [0, 0.15]  // 0-15%
                case 'cvr': return [0, 0.1]   // 0-10%
                case 'cpa': return [200, 0]    // Inverted scale: $200-0 (lower is better)
                case 'roas': return [0, 5]    // 0-5x
                default: return [0, 1]
            }
        }

        // Initial render
        render(group, root)
    }, [data, sizeMetric, colorMetric])

    return (
        <Card className="p-4">
            <svg ref={svgRef} />
        </Card>
    )
} 