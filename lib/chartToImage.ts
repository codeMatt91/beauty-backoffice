import Chart from "chart.js/auto";

export async function renderPieChart(
  slices: { label: string; value: number }[],
  title: string
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;
  canvas.style.cssText = "visibility:hidden;position:absolute;top:-9999px";
  document.body.appendChild(canvas);

  const chart = new Chart(canvas, {
    type: "pie",
    data: {
      labels: slices.map((s) => s.label),
      datasets: [
        {
          data: slices.map((s) => s.value),
          backgroundColor: [
            "#4e79a7",
            "#f28e2b",
            "#e15759",
            "#76b7b2",
            "#59a14f",
            "#edc948",
            "#b07aa1",
            "#ff9da7",
            "#9c755f",
            "#bab0ac",
          ],
        },
      ],
    },
    options: {
      animation: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: { size: 16 },
        },
        legend: {
          position: "bottom",
        },
      },
    },
  });

  // Wait for the chart to finish rendering
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  const dataUrl = canvas.toDataURL("image/png");
  chart.destroy();
  canvas.remove();
  return dataUrl;
}

export async function renderBarLineChart(
  months: {
    label: string;
    entrate: number;
    uscite: number;
    netto: number;
  }[]
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 350;
  canvas.style.cssText = "visibility:hidden;position:absolute;top:-9999px";
  document.body.appendChild(canvas);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    type: "bar",
    data: {
      labels: months.map((m) => m.label),
      datasets: [
        {
          type: "bar",
          label: "Entrate",
          data: months.map((m) => m.entrate),
          backgroundColor: "rgba(78, 121, 167, 0.7)",
          borderColor: "#4e79a7",
          borderWidth: 1,
          yAxisID: "y",
        },
        {
          type: "bar",
          label: "Uscite",
          data: months.map((m) => m.uscite),
          backgroundColor: "rgba(225, 87, 89, 0.7)",
          borderColor: "#e15759",
          borderWidth: 1,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Netto",
          data: months.map((m) => m.netto),
          borderColor: "#59a14f",
          backgroundColor: "rgba(89, 161, 79, 0.1)",
          borderWidth: 2,
          pointRadius: 4,
          fill: false,
          tension: 0.3,
          yAxisID: "y",
        },
      ],
    },
    options: {
      animation: false,
      responsive: false,
      plugins: {
        legend: {
          position: "top",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: number) =>
              new Intl.NumberFormat("it-IT", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              }).format(value),
          },
        },
      },
    },
  };

  const chart = new Chart(canvas, config);

  // Wait for the chart to finish rendering
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  const dataUrl = canvas.toDataURL("image/png");
  chart.destroy();
  canvas.remove();
  return dataUrl;
}
