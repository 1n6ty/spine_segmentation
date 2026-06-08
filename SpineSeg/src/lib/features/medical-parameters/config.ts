export const parametersNames = {
    side: {
        "en-US": {
            vertebras: {
                p1: { name: "Sagittal size of the superior endplate", type: "linear" },
                p2: { name: "Sagittal size of the inferior endplate", type: "linear" },
                p3: { name: "Vertical size of the vertebral body along the anterior contour", type: "linear" },
                p4: { name: "Vertical size of the vertebral body along the posterior contour", type: "linear" },
                p5: { name: "Vertebral body wedging angle", type: "angular" },
                p6: { name: "Inclination angle of the anterior contour of the vertebral body to the Z axis", type: "angular" },
                p7: { name: "Inclination angle of the superior endplate of the vertebral body to the Z axis", type: "angular" },
                p8: { name: "Inclination angle of the inferior endplate of the vertebral body to the Z axis", type: "angular" },
                p9: { name: "Inclination angle of the S1 vertebra endplate to the X axis", type: "angular" }
            },
            gaps: {
                p1: { name: "Intervertebral angle", type: "angular" },
                p2: { name: "Anterior disc height", type: "linear" },
                p3: { name: "Posterior disc height", type: "linear" },
                p4: { name: "Disc wedging angle", type: "angular" },
                p5: { name: "Linear displacement of the upper vertebra in the disc plane", type: "linear" },
                p6: { name: "Angular displacement of the upper vertebra in the disc plane", type: "angular" },
                p7: { name: "Angle between L5 anterior contour and S1 endplate", type: "angular" }
            },
            segments: {
                p1: { name: "Arc radius", type: "linear" },
                p2: { name: "Arc chord length", type: "linear" },
                p3: { name: "Arc central angle", type: "angular" },
                p4: { name: "Arc chord inclination angle", type: "angular" }
            },
            overall: {
                p1: { name: "Th1-L5 trunk axis inclination angle", type: "angular" },
                p2: { name: "Th1-L5 trunk axis length", type: "linear" },
                p3: { name: "GCoM projection (General Center of Mass)", type: "linear" }
            }
        },
        "ru-RU": {
            vertebras: {
                p1: { name: "Сагиттальный размер покровной замыкательной пластинки", type: "linear" },
                p2: { name: "Сагиттальный размер базальной замыкательной пластинки", type: "linear" },
                p3: { name: "Вертикальный размер тела позвонка по переднему контуру", type: "linear" },
                p4: { name: "Вертикальный размер тела позвонка по заднему контуру", type: "linear" },
                p5: { name: "Угол клиновидности тела позвонка", type: "angular" },
                p6: { name: "Угол наклона переднего контура тела позвонка к оси Z", type: "angular" },
                p7: { name: "Угол наклона верхней замыкательной пластинки тела позвонка к оси Z", type: "angular" },
                p8: { name: "Угол наклона нижней замыкательной пластинки тела позвонка к оси Z", type: "angular" },
                p9: { name: "Угол наклона замыкательной пластинки позвонка S1 к оси X", type: "angular" }
            },
            gaps: {
                p1: { name: "Угол между телами позвонков", type: "angular" },
                p2: { name: "Высота диска спереди", type: "linear" },
                p3: { name: "Высота диска сзади", type: "linear" },
                p4: { name: "Угол клиновидности диска", type: "angular" },
                p5: { name: "Линейное смещение верхнего позвонка относительно нижнего в плоскости диска", type: "linear" },
                p6: { name: "Угловое смещение верхнего позвонка относительно нижнего в плоскости диска", type: "angular" },
                p7: { name: "Угол между передним контуром позвонка L5 и замыкательной пластинкой S1", type: "angular" }
            },
            segments: {
                p1: { name: "Радиус дуги", type: "linear" },
                p2: { name: "Длина хорды дуги", type: "linear" },
                p3: { name: "Центральный угол дуги", type: "angular" },
                p4: { name: "Угол наклона хорды дуги", type: "angular" }
            },
            overall: {
                p1: { name: "Угол наклона оси туловища Th1-L5", type: "angular" },
                p2: { name: "Длина оси туловища Th1-L5", type: "linear" },
                p3: { name: "Проекция ОГЦМ (Общий Геометрический Центр Модели)", type: "linear" }
            }
        }
    },
    frontal: {
        "en-US": {
            vertebras: {
                p1: { name: "Frontal size of the superior endplate", type: "linear" },
                p2: { name: "Frontal size of the inferior endplate", type: "linear" },
                p3: { name: "Vertebral body height along the right contour", type: "linear" },
                p4: { name: "Vertebral body height along the left contour", type: "linear" },
                p5: { name: "Vertebral body height in the center", type: "linear" },
                p6: { name: "Frontal wedging angle of the vertebral body", type: "angular" },
                p7: { name: "Inclination angle of the vertebral central line to the Z axis", type: "angular" },
                p8: { name: "Inclination angle of the superior endplate of the vertebral body to the Z axis", type: "angular" },
                p9: { name: "Inclination angle of the inferior endplate of the vertebral body to the Z axis", type: "angular" }
            },
            gaps: {
                p1: { name: "Intervertebral angle", type: "angular" },
                p2: { name: "Right disc height", type: "linear" },
                p3: { name: "Left disc height", type: "linear" },
                p4: { name: "Disc wedging angle", type: "angular" },
                p5: { name: "Linear displacement of the upper vertebra in the disc plane", type: "linear" },
                p6: { name: "Angular displacement of the upper vertebra in the disc plane", type: "angular" },
                p7: { name: "Angle between L5 anterior contour and S1 endplate", type: "angular" }
            },
            segments: {
                p1: { name: "Arc radius", type: "linear" },
                p2: { name: "Arc chord length", type: "linear" },
                p3: { name: "Arc central angle", type: "angular" },
                p4: { name: "Arc chord inclination angle", type: "angular" }
            },
            overall: {
                p1: { name: "Th1-L5 trunk axis inclination angle", type: "angular" },
                p2: { name: "Th1-L5 trunk axis length", type: "linear" },
                p3: { name: "GCoM projection (General Center of Mass)", type: "linear" }
            }
        },
        "ru-RU": {
            vertebras: {
                p1: { name: "Фронтальный размер верхней замыкательной пластинки", type: "linear" },
                p2: { name: "Фронтальный размер нижней замыкательной пластинки", type: "linear" },
                p3: { name: "Высота тела позвонка по правому контуру", type: "linear" },
                p4: { name: "Высота тела позвонка по левому контуру", type: "linear" },
                p5: { name: "Высота тела позвонка по центру", type: "linear" },
                p6: { name: "Угол фронтальной клиновидности тела позвонка", type: "angular" },
                p7: { name: "Угол наклона центральной линии позвонка к оси Z", type: "angular" },
                p8: { name: "Угол наклона верхней замыкательной пластинки тела позвонка к оси Z", type: "angular" },
                p9: { name: "Угол наклона нижней замыкательной пластинки тела позвонка к оси Z", type: "angular" }
            },
            gaps: {
                p1: { name: "Угол между телами позвонков", type: "angular" },
                p2: { name: "Высота диска справа", type: "linear" },
                p3: { name: "Высота диска слева", type: "linear" },
                p4: { name: "Угол клиновидности диска", type: "angular" },
                p5: { name: "Линейное смещение верхнего позвонка относительно нижнего в плоскости диска", type: "linear" },
                p6: { name: "Угловое смещение верхнего позвонка относительно нижнего в плоскости диска", type: "angular" },
                p7: { name: "Угол между передним контуром позвонка L5 и замыкательной пластинкой S1", type: "angular" }
            },
            segments: {
                p1: { name: "Радиус дуги", type: "linear" },
                p2: { name: "Длина хорды дуги", type: "linear" },
                p3: { name: "Центральный угол дуги", type: "angular" },
                p4: { name: "Угол наклона хорды дуги", type: "angular" }
            },
            overall: {
                p1: { name: "Угол наклона оси туловища Th1-L5", type: "angular" },
                p2: { name: "Длина оси туловища Th1-L5", type: "linear" },
                p3: { name: "Проекция ОГЦМ (Общий Геометрический Центр Модели)", type: "linear" }
            }
        }
    }
};