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
                            callback: function(value) {
                                return !horizontal || (showIntegers && Number.isInteger(value)) ? value : null;
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
                                return horizontal || (showIntegers && Number.isInteger(value)) ? value : null;
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
        border: solid #96616B 3px;
        border-radius: 5px;
        width: 100%;
        position: relative;
    }
</style>

<div class="chart-container" style="--height: {height}">
    <canvas id={chartId} bind:this={chartElement}></canvas>
</div>