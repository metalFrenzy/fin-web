import { IsString, IsNumber, Min, IsInt, IsOptional } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0.01, { message: 'Price must be greater than 0' })
  price: number;

  @IsInt()
  @Min(0, { message: 'Available units cannot be negative' })
  availableUnits: number;
}



export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01, { message: 'Price must be greater than 0' })
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'Available units cannot be negative' })
  availableUnits?: number;
}