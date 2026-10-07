<script>
    import { onMount, onDestroy } from 'svelte';
    import Chart from 'chart.js/auto';
    
    export let chartId = 'barChart';
    export let datasets = [];
    export let labels = [];
    export let height = '50vh';
    export let showIntegers = true;
    export let horizontal = true;
    export let suggestedMax = 4;
    
    let chart;
    let chartElement;
    
    onMount(() => {
        if (chartElement) {
            createChart();
        }
    });
    
    export function updateChart(newDatasets, newLabels) {
        if (newDatasets) datasets = newDatasets;
        if (newLabels) labels = newLabels;
        
        if (chart) {
            chart.data.datasets = datasets;
            if (newLabels) chart.data.labels = labels;
            chart.update();
        } else {
            createChart();
        }
    }
    
    // Long labels break onto lines at spaces, never inside a word, so on a
    // phone the axis doesn't take half the chart
    function wrapLabel(text, max) {
        if (typeof text !== 'string' || text.length <= max) return text;
        const lines = [];
        let line = '';
        for (const word of text.split(' ')) {
            if (line && (line + ' ' + word).length > max) {
                lines.push(line);
                line = word;
            } else {
                line = line ? line + ' ' + word : word;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    function createChart() {
        if (chart) {
            chart.destroy();
        }
        
        chart = new Chart(chartElement, {
            type: 'bar',
            data: {
                datasets: datasets,
                labels: labels
            },
            options: {
                // Data changes morph briefly, in step with the rest of the UI
                animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? false
                    : { duration: 350, easing: 'easeOutQuart' },
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: horizontal ? 'y' : 'x',
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: {
                                size: 10
                            },
                            callback: function(value, index) {
                                if (horizontal) {
                                    return wrapLabel(labels[index], this.chart.width < 480 ? 14 : 28);
                                } else {
                                    return (showIntegers && Number.isInteger(value)) ? value : null;
                                }
                            }
                        }
                    },
                    x: {
                        ticks: {
                            display: true,
                            font: {
                                size: 10
                            },
                            callback: function(value) {
                                return (horizontal || !showIntegers) ? value : (Number.isInteger(value) ? value : null);
                            }
                        },
                        min: 0,
                        suggestedMax: suggestedMax
                    }
                }
            }
        });
    }
    
    onDestroy(() => {
        if (chart) {
            chart.destroy();
        }
    });
</script>

<style>
    .chart-container {
        max-height: var(--height);
        min-height: var(--height);
        border: var(--bw) solid var(--primary);
        border-radius: var(--radius-lg);
        width: 100%;
        position: relative;
    }
</style>

<div class="chart-container" style="--height: {height}">
    <canvas id={chartId} bind:this={chartElement}></canvas>
</div>