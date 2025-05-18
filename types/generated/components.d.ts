import type { Schema, Struct } from '@strapi/strapi';

export interface CartCartItem extends Struct.ComponentSchema {
  collectionName: 'components_cart_cart_items';
  info: {
    displayName: 'Cart item';
  };
  attributes: {
    quantity: Schema.Attribute.Integer;
    variant_color: Schema.Attribute.Relation<
      'oneToOne',
      'api::variant-color.variant-color'
    >;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'cart.cart-item': CartCartItem;
    }
  }
}
