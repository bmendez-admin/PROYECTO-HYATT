const VENUES_DEMO = [
  { venue_id: 'bites', nombre: 'Bites', zona_horaria: 'America/Cancun', hora_apertura: '11:00', hora_cierre: '16:00', dia_operativo_inicio: '04:00', turnos_activos_max: 2, turno_vencido_horas: 12, semaforo_amarillo_min: 5, semaforo_rojo_min: 10, meta_espera_min: 10, activo: true },
  { venue_id: 'barefoot', nombre: 'Barefoot Grill', zona_horaria: 'America/Cancun', hora_apertura: '12:00', hora_cierre: '17:00', dia_operativo_inicio: '04:00', turnos_activos_max: 2, turno_vencido_horas: 12, semaforo_amarillo_min: 5, semaforo_rojo_min: 10, meta_espera_min: 10, activo: true },
  { venue_id: 'nook', nombre: 'The Nook Café', zona_horaria: 'America/Cancun', hora_apertura: '00:00', hora_cierre: '24:00', dia_operativo_inicio: '04:00', turnos_activos_max: 2, turno_vencido_horas: 12, semaforo_amarillo_min: 5, semaforo_rojo_min: 10, meta_espera_min: 10, activo: true }
];

const ORDEN_CATEGORIAS_BITES = ['Desayunos', 'Entradas', 'Ensaladas', 'Carnes y aves', 'Pescados y mariscos', 'Bebidas', 'Postres'];

const FOTOS_BITES = ['bites-017', 'bites-018', 'bites-019', 'bites-020', 'bites-021', 'bites-022', 'bites-023', 'bites-025'];

const MENU_BITES = [
  ['Entradas', 'Starters', 'Guacamole con totopos', 'Guacamole with tortilla chips', 'Aguacate machacado al momento con cilantro y limón.', 'Freshly mashed avocado with cilantro and lime.', 'vegetariano', 40, 10],
  ['Entradas', 'Starters', 'Croquetas de jamón', 'Ham croquettes', 'Croquetas cremosas de jamón serrano.', 'Creamy serrano ham croquettes.', '', 40, 10],
  ['Entradas', 'Starters', 'Papas bravas', 'Patatas bravas', 'Papas crujientes con salsa picante y alioli.', 'Crispy potatoes with spicy sauce and aioli.', 'vegetariano,picante', 40, 10],
  ['Entradas', 'Starters', 'Tabla de quesos', 'Cheese board', 'Selección de quesos, frutos secos y mermelada.', 'Selection of cheeses, nuts and jam.', 'vegetariano', 25, 6],
  ['Pescados y mariscos', 'Fish and seafood', 'Ceviche de pescado', 'Fish ceviche', 'Pescado del día en limón con cebolla morada y chile.', 'Catch of the day in lime with red onion and chili.', 'sin gluten,picante', 30, 8],
  ['Pescados y mariscos', 'Fish and seafood', 'Camarones al ajillo', 'Garlic shrimp', 'Camarones salteados con ajo y chile guajillo.', 'Shrimp sautéed with garlic and guajillo chili.', 'picante', 30, 8],
  ['Pescados y mariscos', 'Fish and seafood', 'Tostada de atún', 'Tuna tostada', 'Atún fresco sobre tostada crujiente con aguacate.', 'Fresh tuna on a crispy tostada with avocado.', '', 30, 8],
  ['Ensaladas', 'Salads', 'Ensalada caprese', 'Caprese salad', 'Tomate, mozzarella fresca y albahaca.', 'Tomato, fresh mozzarella and basil.', 'vegetariano,sin gluten', 35, 8],
  ['Ensaladas', 'Salads', 'Ensalada de quinoa', 'Quinoa salad', 'Quinoa con vegetales asados y vinagreta cítrica.', 'Quinoa with roasted vegetables and citrus vinaigrette.', 'vegano,sin gluten', 35, 8],
  ['Carnes y aves', 'Meat and poultry', 'Brochetas de pollo', 'Chicken skewers', 'Pollo marinado a las brasas con salsa de yogur.', 'Grilled marinated chicken with yogurt sauce.', 'sin gluten', 40, 10],
  ['Entradas', 'Starters', 'Empanadas de queso', 'Cheese empanadas', 'Masa dorada rellena de queso fundido.', 'Golden pastry filled with melted cheese.', 'vegetariano', 40, 10],
  ['Postres', 'Desserts', 'Churros con chocolate', 'Churros with chocolate', 'Churros recién hechos con chocolate caliente.', 'Freshly made churros with hot chocolate.', 'vegetariano', 40, 10],
  ['Postres', 'Desserts', 'Panna cotta de frutos rojos', 'Berry panna cotta', 'Crema suave de vainilla con salsa de frutos rojos.', 'Smooth vanilla cream with berry sauce.', 'vegetariano,sin gluten', 30, 8],
  ['Desayunos', 'Breakfast', 'Chilaquiles verdes', 'Green chilaquiles', 'Totopos bañados en salsa verde con crema, queso fresco y cebolla.', 'Tortilla chips in green salsa with cream, fresh cheese and onion.', 'vegetariano,picante', 30, 8],
  ['Desayunos', 'Breakfast', 'Hotcakes con frutos rojos', 'Pancakes with berries', 'Hotcakes esponjosos con frutos rojos y miel de maple.', 'Fluffy pancakes with mixed berries and maple syrup.', 'vegetariano', 30, 8],
  ['Carnes y aves', 'Meat and poultry', 'Arrachera a las brasas', 'Grilled skirt steak', 'Arrachera marinada a las brasas con cebollitas cambray.', 'Marinated skirt steak grilled over embers with spring onions.', 'sin gluten', 30, 8],
  ['Pescados y mariscos', 'Fish and seafood', 'Langostinos al ajillo', 'Garlic prawns', 'Langostinos salteados con ajo, perejil y aceite de oliva.', 'Prawns sautéed with garlic, parsley and olive oil.', 'sin gluten', 30, 8],
  ['Pescados y mariscos', 'Fish and seafood', 'Mejillones al vino blanco', 'Mussels in white wine', 'Mejillones y camarones al vino blanco con perejil.', 'Mussels and shrimp in white wine with parsley.', 'sin gluten', 30, 8],
  ['Pescados y mariscos', 'Fish and seafood', 'Salmón de la casa', 'House salmon', 'Salmón a la plancha con romero y limón.', 'Pan-seared salmon with rosemary and lemon.', 'sin gluten', 30, 8],
  ['Pescados y mariscos', 'Fish and seafood', 'Mejillones horneados', 'Baked mussels', 'Mejillones gratinados al horno con queso y limón.', 'Oven-baked mussels gratinéed with cheese and lemon.', '', 30, 8],
  ['Pescados y mariscos', 'Fish and seafood', 'Pasta al pesto con camarones', 'Pesto pasta with shrimp', 'Pasta fresca con salsa pesto (aceite de oliva extra virgen, ajo, albahaca, queso parmesano y piñones) con camarones y coronada con tomate deshidratado y hojas de albahaca.', 'Fresh pasta with pesto sauce (extra virgin olive oil, garlic, basil, Parmesan cheese and pine nuts) with shrimp, topped with sun-dried tomato and basil leaves.', '', 30, 8],
  ['Pescados y mariscos', 'Fish and seafood', 'Pulpo a la gallega', 'Galician-style octopus', 'Pulpo cocido sobre cama de papa con pimentón y aceite de oliva.', 'Boiled octopus over potato with paprika and olive oil.', 'sin gluten', 30, 8],
  ['Bebidas', 'Drinks', 'Limonada con menta', 'Mint lemonade', 'Limonada natural con hojas de menta fresca.', 'Fresh lemonade with mint leaves.', 'vegano,sin gluten', 60, 15],
  ['Bebidas', 'Drinks', 'Agua de jamaica', 'Hibiscus water', 'Agua fresca de flor de jamaica.', 'Chilled hibiscus flower water.', 'vegano,sin gluten', 60, 15],
  ['Postres', 'Desserts', 'Tarta de frutas', 'Fruit tart', 'Tarta de masa quebrada con crema pastelera y frutas frescas.', 'Shortcrust tart with pastry cream and fresh fruit.', 'vegetariano', 30, 8]
];

const APELLIDOS_DEMO = [
  'Alvarado', 'Beltrán', 'Cárdenas', 'Domínguez', 'Espinosa',
  'Fuentes', 'Galindo', 'Herrera', 'Ibarra', 'Jiménez',
  'Krause', 'Lozano', 'Montenegro', 'Navarro', 'Ochoa',
  'Paredes', 'Quintero', 'Reyes', 'Salgado', 'Treviño'
];

const CHEFS_DEMO = [
  { chef_id: 'chef-01', nombre: 'Mateo', activo: true },
  { chef_id: 'chef-02', nombre: 'Lucía', activo: true },
  { chef_id: 'chef-03', nombre: 'Andrés', activo: true }
];

function productosBites() {
  return MENU_BITES.map((fila, i) => {
    const productoId = 'bites-' + ('00' + (i + 1)).slice(-3);
    return {
      producto_id: productoId,
      venue_id: 'bites',
      categoria_es: fila[0],
      categoria_en: fila[1],
      nombre_es: fila[2],
      nombre_en: fila[3],
      descripcion_es: fila[4],
      descripcion_en: fila[5],
      imagen: FOTOS_BITES.indexOf(productoId) === -1 ? '' : productoId,
      etiquetas: fila[6],
      stock_actual: fila[7],
      stock_minimo: fila[8],
      activo: true,
      orden: (ORDEN_CATEGORIAS_BITES.indexOf(fila[0]) + 1) * 100 + i + 1
    };
  });
}

function movimientosIniciales(productos) {
  const ahora = new Date();
  return productos.map(producto => ({
    mov_id: 'MOV-' + producto.producto_id,
    venue_id: producto.venue_id,
    producto_id: producto.producto_id,
    tipo: 'inicial',
    cantidad: producto.stock_actual,
    stock_resultante: producto.stock_actual,
    hora: ahora,
    responsable: 'setup'
  }));
}

function generarHuespedes() {
  const edificios = [{ letra: 'A', base: 0 }, { letra: 'B', base: 400 }];
  const huespedes = [];
  let indice = 0;
  let siguienteApellido = 0;
  edificios.forEach(edificio => {
    for (let piso = 1; piso <= 4; piso++) {
      for (let habitacion = 1; habitacion <= 5; habitacion++) {
        const cuarto = String(edificio.base + piso * 100 + habitacion);
        const ocupado = indice % 2 === 0;
        huespedes.push({
          huesped_id: 'H' + cuarto,
          cuarto: cuarto,
          edificio: edificio.letra,
          piso: piso,
          nombre_display: ocupado ? APELLIDOS_DEMO[siguienteApellido++] : '',
          ocupado: ocupado
        });
        indice++;
      }
    }
  });
  return huespedes;
}