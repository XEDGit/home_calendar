<script>
    import { onMount, onDestroy } from 'svelte';
    import Chart from 'chart.js/auto';
    
    export let chartId = 'statsChart';
    export let datasets = [];
    export let labels = [];
    export let height = '25vh';
    export let showIntegers = true;
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
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets,
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        ticks: {
                            display: true,
                            font: {
                                size: 10
                            },
                            callback: function(value) {
                                return showIntegers && !Number.isInteger(value) ? null : value;
                            }
                        },
                        min: 0,
                        suggestedMax: suggestedMax,
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 10
                            }
                        }
                    }
                },
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